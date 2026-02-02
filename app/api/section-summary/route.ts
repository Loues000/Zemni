import { NextResponse } from "next/server";
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

const NOTES_CHUNK_CHARS = 12_000;
const NOTES_CHUNK_OVERLAP_CHARS = 350;
const NOTES_MAX_CHUNKS_PER_SECTION = 8;
const NOTES_CONCURRENCY = 3;
const NOTES_CALL_TIMEOUT_MS = 60_000;
const FINAL_CALL_TIMEOUT_MS = 180_000;
const CHUNKING_THRESHOLD_CHARS = 12_000;

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

export async function POST(request: Request) {
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

  // Check if user has access to this model (subscription OR API key)
  const hasModelAccess = checkModelAvailability(
    { id: model.openrouterId, subscriptionTier: model.subscriptionTier },
    userContext
  );

  if (!hasModelAccess) {
    return NextResponse.json(
      { error: "This model is not available for your subscription tier" },
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

  const start = Date.now();

  const totalChars = sections.reduce((acc, s) => acc + (s.text?.length ?? 0), 0);

  const shouldChunk =
    totalChars > CHUNKING_THRESHOLD_CHARS ||
    sections.some((s) => (s.text?.length ?? 0) > CHUNKING_THRESHOLD_CHARS);

  const usages: Array<LanguageModelUsage | undefined> = [];

  const summarizeDirect = async (): Promise<{ text: string; usage: LanguageModelUsage | undefined }> => {
    const { systemPrompt, userPrompt } = await buildSectionSummaryPrompts(sections, structure);
    const result = await generateWithTimeout(
      modelId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      apiKeys,
      openrouterClient,
      {
        maxTokens: 2800,
        temperature: 0.2,
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
          title: `${section.title} (Teil ${index + 1})`,
          text: chunkText,
          page: section.page
        });
      });
    }

    const chunkNotes = await mapWithConcurrency(noteSections, NOTES_CONCURRENCY, async (noteSection) => {
      const { systemPrompt, userPrompt } = await buildChunkNotesPrompts(noteSection, { maxBullets: 42 });
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
            maxTokens: 950,
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

    const { systemPrompt, userPrompt } = await buildSectionSummaryPrompts(notesAsSections, structure);
    const result = await generateWithTimeout(
      modelId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      apiKeys,
      openrouterClient,
      {
        maxTokens: 2800,
        temperature: 0.2,
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
