import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { buildFlashcardsPrompts } from "@/lib/study-prompts";
import { estimateFlashcardsPerSection } from "@/lib/study-heuristics";
import { parseJsonFromModelText } from "@/lib/parse-model-json";
import { createTimeoutController, isAbortError, mapWithConcurrency, splitTextIntoChunks, sumUsage, getModelPerformanceConfig } from "@/lib/ai-performance";
import { getUserContext, checkModelAvailability, getApiKeyToUse, getApiKeyForModel } from "@/lib/api-helpers";
import { isModelAvailable } from "@/lib/models";
import { createOpenRouterClient } from "@/lib/openrouter";
import { generateWithProvider, type ProviderInfo } from "@/lib/providers";
import { api } from "@/convex/_generated/api";
import { validateModelId, validateFlashcardsDensity } from "@/lib/utils/validation";
import type { DocumentSection, Flashcard, UsageStats } from "@/types";
import { getConvexClient } from "@/lib/convex-server";

export const runtime = "nodejs";
export const maxDuration = 300;

const CHUNK_CHARS = 7_500;
const CHUNK_OVERLAP_CHARS = 350;
const MAX_CHUNKS = 4;
const FLASHCARDS_PER_SECTION_HARD_CAP = 20;

/**
 * Parse unknown input into normalized document sections.
 */
const toSections = (value: unknown): DocumentSection[] => {
  if (!Array.isArray(value)) return [];
  const sections: DocumentSection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    const title = String(record.title ?? "").trim();
    const text = String(record.text ?? "");
    const pageValue = record.page;
    const page = typeof pageValue === "number" ? pageValue : undefined;
    if (!id || !text.trim()) continue;
    sections.push({ id, title: title || id, text, page });
  }
  return sections;
};

type ModelFlashcard = {
  sectionId: string;
  sectionTitle: string;
  type: "qa" | "cloze";
  front: string;
  back: string;
  sourceSnippet: string;
  page?: number;
};

type FlashcardsResult = {
  flashcards: ModelFlashcard[];
};

/**
 * Clamp and floor a number into the provided integer range.
 */
const clampInt = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

/**
 * Generate flashcards for provided sections using the requested model.
 */
export async function POST(request: Request) {
  const { userId: clerkUserId } = await auth();
  const userContext = await getUserContext();
  const apiKey = getApiKeyToUse(userContext);

  if (!apiKey) {
    return NextResponse.json({ error: "Missing OpenRouter key" }, { status: 400 });
  }

  const body = await request.json();
  const sections = toSections(body.sections);
  const modelId = String(body.modelId ?? "");
  const nRaw = Number(body.cardsPerSection ?? body.n ?? 0);
  const coverageLevelRaw = Number(body.coverageLevel ?? body.coverage ?? 0);
  const coverageLevel: 1 | 2 | 3 =
    coverageLevelRaw === 1 || coverageLevelRaw === 2 || coverageLevelRaw === 3 ? (coverageLevelRaw as 1 | 2 | 3) : 2;
  const totalChars = sections.reduce((acc, s) => acc + s.text.length, 0);
  const avgChars = sections.length > 0 ? Math.round(totalChars / sections.length) : totalChars;
  const adjustedEstimated = estimateFlashcardsPerSection(avgChars, coverageLevel);
  const cardsPerSection =
    Number.isFinite(nRaw) && nRaw > 0
      ? Math.max(1, Math.min(30, Math.floor(nRaw)))
      : adjustedEstimated;
  const targetCardsPerSection = Math.min(cardsPerSection, FLASHCARDS_PER_SECTION_HARD_CAP);

  if (!modelId || sections.length === 0) {
    return NextResponse.json({ error: "Missing modelId or sections" }, { status: 400 });
  }

  // Validate model ID
  const modelValidation = await validateModelId(modelId);
  if (!modelValidation.valid) {
    return NextResponse.json({ error: modelValidation.error }, { status: 400 });
  }

  // Validate coverage level (density)
  const densityValidation = validateFlashcardsDensity(coverageLevel);
  if (!densityValidation.valid) {
    return NextResponse.json({ error: densityValidation.error }, { status: 400 });
  }

  // Validate sections have valid structure
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section.id || !section.text || section.text.trim().length === 0) {
      return NextResponse.json(
        { error: `Section at index ${i} is invalid: must have id and non-empty text` },
        { status: 400 }
      );
    }
  }

  const models = await loadModels();
  const model = models.find((item) => item.openrouterId === modelId) ?? null;

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 400 });
  }

  const allowUnlimitedOutput = model.pricing.output_per_1m === 0;

  // Check if user has access to this model (subscription OR API key)
  const hasModelAccess = checkModelAvailability(
    { id: model.openrouterId, subscriptionTier: model.subscriptionTier },
    userContext
  );

  if (!hasModelAccess) {
    return NextResponse.json(
      { error: "This model is not available for your subscription tier. Add an API key in settings to use higher tier models." },
      { status: 403 }
    );
  }

  // Check monthly usage limit
  if (userContext) {
    try {
      const convex = getConvexClient();
      const monthlyUsage = await convex.query(api.usage.getMonthlyGenerationCount, {});
      if (monthlyUsage.count >= monthlyUsage.limit) {
        return NextResponse.json(
          {
            error: `Monthly limit reached (${monthlyUsage.count}/${monthlyUsage.limit} generations). Upgrade your plan for more generations.`,
            limitReached: true,
            currentCount: monthlyUsage.count,
            limit: monthlyUsage.limit,
          },
          { status: 429 }
        );
      }
    } catch (err) {
      console.error("Failed to check usage limit:", err);
      // Continue with generation if limit check fails (fail open)
    }
  }

  // Determine which API key to use (system key for subscription models, user key for own-cost models)
  const modelApiKeyInfo = getApiKeyForModel(modelId, userContext, model);
  const finalApiKey = modelApiKeyInfo?.key || apiKey;
  const isOwnKey = !!modelApiKeyInfo?.isOwnKey;

  // Debug logging (only when using own key)
  if (isOwnKey) {
    console.log(`[flashcards] Using own ${modelApiKeyInfo?.provider || "openrouter"} key for ${modelId}`);
  }

  // Prepare API keys array for generateWithProvider if using own key
  const apiKeys = isOwnKey && userContext
    ? userContext.apiKeys.map(k => ({
      provider: k.provider,
      key: k.key || "",
      isOwnKey: k.useOwnKey,
    }))
    : [];

  // Get user preferences for language and custom guidelines
  const userLanguage = userContext?.preferredLanguage || "en";
  const customGuidelines = userContext?.customGuidelines;

  const openrouterClient = !isOwnKey ? createOpenRouterClient(finalApiKey) : null;
  const start = Date.now();

  const tasks: Array<{
    sectionMeta: Pick<DocumentSection, "id" | "title" | "page">;
    chunkText: string;
    cardsWanted: number;
  }> = [];

  for (const section of sections) {
    const chunks = splitTextIntoChunks(section.text, CHUNK_CHARS, { overlapChars: CHUNK_OVERLAP_CHARS, maxChunks: MAX_CHUNKS });
    const chunkCount = Math.max(1, chunks.length);
    const base = Math.floor(targetCardsPerSection / chunkCount);
    let remainder = targetCardsPerSection % chunkCount;

    for (const chunkText of chunks) {
      const desired = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      const cardsWanted = clampInt(desired, 1, 12);
      tasks.push({
        sectionMeta: { id: section.id, title: section.title, page: section.page },
        chunkText,
        cardsWanted
      });
    }
  }

  /**
   * Validates flashcard structure
   */
  const validateFlashcard = (card: any): card is ModelFlashcard => {
    if (!card || typeof card !== "object") return false;
    const sectionId = String(card.sectionId ?? "").trim();
    const front = String(card.front ?? "").trim();
    const back = String(card.back ?? "").trim();
    const sourceSnippet = String(card.sourceSnippet ?? "").trim();
    // Normalize type: accept "qa", "Q&A", "question", etc. and convert to "qa" or "cloze"
    const typeRaw = String(card.type ?? "").toLowerCase();
    const type = typeRaw === "cloze" || typeRaw.includes("cloze") ? "cloze" : "qa";

    return sectionId.length > 0 && front.length > 0 && back.length > 0 && sourceSnippet.length > 0;
  };

  const perfConfig = getModelPerformanceConfig(modelId);
  const results = await mapWithConcurrency(tasks, 2, async (task) => {
    /**
     * Generate flashcards for a single chunk with progressive retries.
     */
    const generateFlashcards = async (retryCount: number = 0): Promise<{ flashcards: ModelFlashcard[]; usage: any }> => {
      const { systemPrompt, userPrompt } = await buildFlashcardsPrompts(
        [{ id: task.sectionMeta.id, title: task.sectionMeta.title, text: task.chunkText, page: task.sectionMeta.page }],
        task.cardsWanted,
        userLanguage,
        customGuidelines
      );

      // Progressive retries:
      // Retry 1: Add JSON format instructions
      // Retry 2: Increase maxTokens (already handled by multiplier, but can be forced)
      // Retry 3: Reduce cards wanted
      const currentCardsWanted = retryCount < 2 ? task.cardsWanted : Math.max(1, Math.floor(task.cardsWanted * 0.7));

      const enhancedSystemPrompt = retryCount > 0
        ? `${systemPrompt}\n\nCRITICAL: Output ONLY valid JSON. No markdown, no code fences, no explanations. The JSON must be parseable. Ensure all strings are properly escaped and closed.`
        : systemPrompt;

      const timeout = createTimeoutController(perfConfig.timeoutMs * (retryCount + 1));
      try {
        const baseMaxTokens = Math.min(4096, Math.max(1500, currentCardsWanted * 250));
        let adjustedMaxTokens = Math.floor(baseMaxTokens * perfConfig.maxTokensMultiplier);

        // Boost max tokens even more on retry if it looked truncated
        if (retryCount > 0) adjustedMaxTokens = Math.floor(adjustedMaxTokens * 1.5);

        let result: { text: string; usage: any };
        const maxTokens = allowUnlimitedOutput ? undefined : adjustedMaxTokens;

        if (isOwnKey && modelApiKeyInfo) {
          const providerResult = await generateWithProvider(modelId, [
            { role: "system", content: enhancedSystemPrompt },
            { role: "user", content: userPrompt }
          ], apiKeys, {
            maxTokens,
            temperature: 0.2, // Lower temperature for more stable JSON
            maxRetries: 1,
          });
          result = {
            text: providerResult.text,
            usage: providerResult.usage,
          };
        } else {
          const genResult = await generateText({
            model: openrouterClient!(modelId) as any,
            maxTokens,
            temperature: 0.2,
            maxRetries: 1,
            abortSignal: timeout.signal,
            messages: [
              { role: "system", content: enhancedSystemPrompt },
              { role: "user", content: userPrompt }
            ]
          });
          result = {
            text: genResult.text,
            usage: genResult.usage,
          };
        }

        if (!result.text || result.text.trim().length < 10) {
          if (retryCount < 2) {
            console.warn(`[Flashcards] Empty response from ${modelId}, retrying (${retryCount + 1})...`);
            timeout.cancel();
            return generateFlashcards(retryCount + 1);
          }
        }

        try {
          const parsed = parseJsonFromModelText<FlashcardsResult>(result.text);

          if (!parsed || typeof parsed !== "object") {
            throw new Error("Parsed result is not an object");
          }

          const flashcardsRaw = parsed.flashcards;
          if (!Array.isArray(flashcardsRaw)) {
            console.warn(`[Flashcards] Invalid flashcards field: expected array, got ${typeof flashcardsRaw}`);
            if (retryCount < 2) {
              timeout.cancel();
              return generateFlashcards(retryCount + 1);
            }
            return { flashcards: [], usage: result.usage };
          }

          const flashcards = flashcardsRaw.filter(validateFlashcard);

          if (flashcards.length === 0 && retryCount < 1) {
            console.warn(`[Flashcards] No valid flashcards from model ${modelId}, retrying...`);
            timeout.cancel();
            return generateFlashcards(retryCount + 1);
          }

          return { flashcards, usage: result.usage };
        } catch (parseErr) {
          const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          const isTruncated = errMsg.includes("truncated") || errMsg.includes("Expected ',' or ']'") || errMsg.includes("Unexpected end");

          if (retryCount < 2) {
            console.warn(`[Flashcards] JSON parse error (${isTruncated ? "truncated" : "malformed"}) for model ${modelId}, retrying (${retryCount + 1})...`);
            timeout.cancel();
            return generateFlashcards(retryCount + 1);
          }

          console.error(`[Flashcards] JSON parse error for model ${modelId} after multiple retries:`, errMsg);
          return { flashcards: [], usage: result.usage };
        }
      } catch (err) {
        if (isAbortError(err)) {
          if (retryCount < 1) {
            console.warn(`[Flashcards] Timeout for model ${modelId}, retrying with longer timeout...`);
            return generateFlashcards(retryCount + 1);
          }
          return { flashcards: [], usage: undefined };
        }
        throw err;
      } finally {
        timeout.cancel();
      }
    };

    return generateFlashcards();
  });

  const flashcards: Flashcard[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    for (const c of r.flashcards ?? []) {
      const sectionId = String(c.sectionId ?? "").trim();
      const sectionTitle = String(c.sectionTitle ?? "").trim() || sectionId;
      const type: Flashcard["type"] = c.type === "cloze" ? "cloze" : "qa";
      const front = String(c.front ?? "").trim();
      const back = String(c.back ?? "").trim();
      const sourceSnippet = String(c.sourceSnippet ?? "").trim();
      const page = typeof c.page === "number" ? c.page : undefined;

      if (!sectionId || !front || !back || !sourceSnippet) continue;
      const key = `${type}|${front.toLowerCase()}|${back.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      flashcards.push({
        id: crypto.randomUUID(),
        sectionId,
        sectionTitle,
        type,
        front,
        back,
        sourceSnippet: sourceSnippet.length > 240 ? sourceSnippet.slice(0, 239) + "..." : sourceSnippet,
        page
      });
    }
  }

  const usageAgg = sumUsage(results.map((r) => r.usage));
  const usage: UsageStats | null = buildUsageStats(usageAgg, Date.now() - start, model, "flashcards");

  // Save usage to Convex if user is authenticated
  if (clerkUserId) {
    try {
      const convex = getConvexClient();
      await convex.mutation(api.usage.recordUsage, {
        source: "flashcards",
        tokensIn: usageAgg?.promptTokens || 0,
        tokensOut: usageAgg?.completionTokens || 0,
        cost: usage?.costTotal || 0,
        modelId: modelId,
        clerkUserId: clerkUserId,
      });
    } catch (err) {
      console.error("Failed to record usage:", err);
      // Don't fail the request if usage recording fails
    }
  }

  return NextResponse.json({ flashcards, usage, meta: { requestedCardsPerSection: cardsPerSection, usedCardsPerSection: targetCardsPerSection } });
}
