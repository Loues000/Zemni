import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { enforceOutputFormat } from "@/lib/format-output";
import { buildChunkNotesPrompts, buildSectionSummaryPrompts } from "@/lib/study-prompts";
import { isAbortError, mapWithConcurrency, splitTextIntoChunks, sumUsage } from "@/lib/ai-performance";
import { getUserContext, checkModelAvailability, getApiKeyToUse, getApiKeyForModel } from "@/lib/api-helpers";
import { isModelAvailable } from "@/lib/models";
import { generateWithProvider, type ProviderInfo } from "@/lib/providers";
import { createOpenRouterClient } from "@/lib/openrouter";
import { generateText } from "ai";
import type { DocumentSection, UsageStats } from "@/types";
import type { LanguageModelUsage } from "ai";

// Helper to generate text with timeout, handling both own keys and system keys
const generateWithTimeout = async (
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  apiKeys: ProviderInfo[],
  openrouterClient: ReturnType<typeof createOpenRouterClient> | null,
  options: { maxTokens?: number; temperature?: number; maxRetries?: number; timeoutMs: number; apiId?: string }
): Promise<{ text: string; usage: LanguageModelUsage | undefined }> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const err = new Error("Timeout");
      err.name = "AbortError";
      reject(err);
    }, options.timeoutMs);
  });

  const isUsingOwnKey = apiKeys.length > 0 && apiKeys.some(k => k.isOwnKey);

  try {
    if (isUsingOwnKey) {
      // Use direct provider API for user's own key
      const result = await Promise.race([
        generateWithProvider(modelId, messages, apiKeys, {
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          maxRetries: options.maxRetries,
        }),
        timeoutPromise,
      ]);
      return { text: result.text, usage: result.usage };
    } else {
      const result = await Promise.race([
        generateText({
          model: openrouterClient!(options.apiId || modelId) as any,
          messages: messages as any,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          maxRetries: options.maxRetries,
        }),
        timeoutPromise,
      ]);
      return { text: result.text, usage: result.usage };
    }
  } catch (err) {
    // Log concise error info before rethrowing
    const errorObj = err as any;
    if (errorObj?.statusCode || errorObj?.url) {
      const message = errorObj.message || String(err);
      const url = errorObj.url || 'unknown';
      const status = errorObj.statusCode || 'unknown';
      console.error(`[generateWithTimeout] API error (${status}): ${message} at ${url}`);
    }
    throw err;
  }
};

export const runtime = "nodejs";
export const maxDuration = 300;

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const NOTES_CHUNK_CHARS = 12_000;
const NOTES_CHUNK_OVERLAP_CHARS = 350;
const NOTES_MAX_CHUNKS_PER_SECTION = 8;
const NOTES_CONCURRENCY = 5;
const NOTES_CALL_TIMEOUT_MS = 45_000;
const FINAL_CALL_TIMEOUT_MS = 120_000;
const CHUNKING_THRESHOLD_CHARS = 35_000;

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

/**
 * Summarizes document sections into a structured summary using the specified model.
 *
 * @param request - Request whose JSON body must include `sections` (array of objects with at least `id` and `text`), `modelId`, and may include `structure` and `titleHint`.
 * @returns JSON with `{ summary, usage, meta }` on success where `meta` contains `chunked` (boolean) and `totalChars` (number); or `{ error }` with an HTTP status on failure. Possible error statuses:
 * - 400: missing OpenRouter key, missing `modelId` or `sections`, or model not found
 * - 403: model not available for the user's subscription tier (suggest adding an API key)
 * - 504: summary generation timed out
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
  const structure = String(body.structure ?? "");
  const titleHint = String(body.titleHint ?? "");

  if (!modelId || sections.length === 0) {
    return NextResponse.json({ error: "Missing modelId or sections" }, { status: 400 });
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

  // Determine which API key to use (system key for subscription models, user key for own-cost models)
  const modelApiKeyInfo = getApiKeyForModel(modelId, userContext, model);
  const finalApiKey = modelApiKeyInfo?.key || apiKey;
  const isOwnKey = !!modelApiKeyInfo?.isOwnKey;

  // Prepare API keys array for generateWithProvider if using own key
  const apiKeys = isOwnKey && userContext
    ? userContext.apiKeys.map(k => ({
      provider: k.provider,
      key: k.key || "",
      isOwnKey: k.useOwnKey,
    }))
    : [];

  // Debug logging (only when using own key)
  if (isOwnKey) {
    console.log(`[section-summary] Using own ${modelApiKeyInfo?.provider || "openrouter"} key for ${modelId}`);
  }

  // Prepare OpenRouter client for system key (when not using own key)
  const openrouterClient = !isOwnKey ? createOpenRouterClient(finalApiKey) : null;

  // Get user preferences for language and custom guidelines
  const userLanguage = userContext?.preferredLanguage || "en";
  const customGuidelines = userContext?.customGuidelines;

  const start = Date.now();

  const totalChars = sections.reduce((acc, s) => acc + (s.text?.length ?? 0), 0);

  const shouldChunk =
    totalChars > CHUNKING_THRESHOLD_CHARS ||
    sections.some((s) => (s.text?.length ?? 0) > CHUNKING_THRESHOLD_CHARS);

  const usages: Array<LanguageModelUsage | undefined> = [];

  const summarizeDirect = async (): Promise<{ text: string; usage: LanguageModelUsage | undefined }> => {
    const { systemPrompt, userPrompt } = await buildSectionSummaryPrompts(sections, structure, userLanguage, customGuidelines);

    // Dynamic maxTokens based on content length and number of sections
    // More realistic: ~3 characters per token (accounts for markdown overhead)
    const charBasedTokens = Math.floor(totalChars / 3);
    // More tokens per section for comprehensive summaries
    const sectionBasedTokens = sections.length * 1000;
    // Higher minimum (8000) and higher maximum (16000) to allow complete summaries
    const dynamicMaxTokens = Math.min(16000, Math.max(8000, charBasedTokens, sectionBasedTokens));
    const maxTokens = allowUnlimitedOutput ? undefined : dynamicMaxTokens;

    const result = await generateWithTimeout(
      modelId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      apiKeys,
      openrouterClient,
      {
        maxTokens,
        temperature: 0.1,
        maxRetries: 1,
        timeoutMs: FINAL_CALL_TIMEOUT_MS,
      }
    );
    return { text: result.text, usage: result.usage };
  };

  const summarizeViaNotes = async (): Promise<{ text: string; usage: LanguageModelUsage | undefined }> => {
    const noteSections: DocumentSection[] = [];

    for (const section of sections) {
      const chunks = splitTextIntoChunks(section.text, NOTES_CHUNK_CHARS, {
        overlapChars: NOTES_CHUNK_OVERLAP_CHARS,
        maxChunks: NOTES_MAX_CHUNKS_PER_SECTION
      });

      if (chunks.length <= 1) {
        noteSections.push(section);
        continue;
      }

      chunks.forEach((chunkText, index) => {
        noteSections.push({
          id: `${section.id}#${index + 1}`,
          title: `${section.title} (Part ${index + 1})`,
          text: chunkText,
          page: section.page
        });
      });
    }

    const chunkNotes = await mapWithConcurrency(noteSections, NOTES_CONCURRENCY, async (noteSection) => {
      const { systemPrompt, userPrompt } = await buildChunkNotesPrompts(noteSection, { maxBullets: 42, language: userLanguage, customGuidelines });
      try {
        const result = await generateWithTimeout(
          modelId,
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          apiKeys,
          openrouterClient,
          {
            maxTokens: allowUnlimitedOutput ? undefined : 950,
            temperature: 0.2,
            maxRetries: 1,
            timeoutMs: NOTES_CALL_TIMEOUT_MS,
          }
        );
        return { section: noteSection, notes: result.text, usage: result.usage };
      } catch (err) {
        if (isAbortError(err)) {
          return { section: noteSection, notes: "", usage: undefined };
        }
        throw err;
      }
    });

    usages.push(...chunkNotes.map((r) => r.usage));

    const notesAsSections: DocumentSection[] = chunkNotes.map((r) => ({
      id: r.section.id,
      title: r.section.title,
      text: r.notes,
      page: r.section.page
    }));

    const { systemPrompt, userPrompt } = await buildSectionSummaryPrompts(notesAsSections, structure, userLanguage, customGuidelines);

    // Dynamic maxTokens for the final summary assembly
    const totalNoteChars = notesAsSections.reduce((acc, s) => acc + (s.text?.length ?? 0), 0);
    // More realistic: ~3 characters per token (accounts for markdown overhead)
    const charBasedTokens = Math.floor(totalNoteChars / 3);
    // More tokens per section for comprehensive summaries
    const sectionBasedTokens = notesAsSections.length * 1000;
    // Higher minimum (8000) and higher maximum (16000) to allow complete summaries
    const dynamicMaxTokens = Math.min(16000, Math.max(8000, charBasedTokens, sectionBasedTokens));
    const maxTokens = allowUnlimitedOutput ? undefined : dynamicMaxTokens;

    const result = await generateWithTimeout(
      modelId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      apiKeys,
      openrouterClient,
      {
        maxTokens,
        temperature: 0.1,
        maxRetries: 1,
        timeoutMs: FINAL_CALL_TIMEOUT_MS,
      }
    );
    return { text: result.text, usage: result.usage };
  };

  try {
    const result = shouldChunk ? await summarizeViaNotes() : await summarizeDirect();
    usages.push(result.usage);

    const summary = enforceOutputFormat(result.text, titleHint || undefined);
    const usageAgg = sumUsage(usages);
    const usage: UsageStats | null = buildUsageStats(usageAgg, Date.now() - start, model, "section-summary");

    // Save usage to Convex if user is authenticated
    if (clerkUserId) {
      try {
        await convex.mutation(api.usage.recordUsage, {
          source: "section-summary",
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

    return NextResponse.json({ summary, usage, meta: { chunked: shouldChunk, totalChars } });
  } catch (err) {
    if (isAbortError(err)) {
      return NextResponse.json({ error: "Summary generation timed out. Try a faster model or shorter input." }, { status: 504 });
    }
    // Log error concisely before rethrowing
    const errorObj = err as any;
    if (errorObj?.statusCode || errorObj?.url) {
      console.error(`[section-summary] API error: ${errorObj.statusCode || 'unknown'} at ${errorObj.url || 'unknown'}: ${errorObj.message || String(err)}`);
    }
    throw err;
  }
}