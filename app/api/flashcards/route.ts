import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { buildFlashcardsPrompts } from "@/lib/study-prompts";
import { estimateFlashcardsPerSection } from "@/lib/study-heuristics";
import { parseJsonFromModelText } from "@/lib/parse-model-json";
import { createTimeoutController, isAbortError, mapWithConcurrency, splitTextIntoChunks, sumUsage, getModelPerformanceConfig } from "@/lib/ai-performance";
import type { DocumentSection, Flashcard, UsageStats } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const CHUNK_CHARS = 7_500;
const CHUNK_OVERLAP_CHARS = 350;
const MAX_CHUNKS = 4;
const FLASHCARDS_PER_SECTION_HARD_CAP = 20;

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

const clampInt = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
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

  const models = await loadModels();
  const model = models.find((item) => item.openrouterId === modelId) ?? null;
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

  const perfConfig = getModelPerformanceConfig(modelId);
  const results = await mapWithConcurrency(tasks, 2, async (task) => {
    const { systemPrompt, userPrompt } = await buildFlashcardsPrompts(
      [{ id: task.sectionMeta.id, title: task.sectionMeta.title, text: task.chunkText, page: task.sectionMeta.page }],
      task.cardsWanted
    );

    const timeout = createTimeoutController(perfConfig.timeoutMs);
    try {
      const baseMaxTokens = Math.min(4096, Math.max(900, task.cardsWanted * 190));
      const adjustedMaxTokens = Math.floor(baseMaxTokens * perfConfig.maxTokensMultiplier);
      const result = await generateText({
        model: openrouter(modelId) as any,
        maxTokens: adjustedMaxTokens,
        temperature: 0.2,
        maxRetries: 1,
        abortSignal: timeout.signal,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });

      try {
        const parsed = parseJsonFromModelText<FlashcardsResult>(result.text);
        return { flashcards: parsed.flashcards ?? [], usage: result.usage };
      } catch (parseErr) {
        // Log parsing error for debugging, but still return empty array to not break the flow
        console.error(`[Flashcards] JSON parse error for model ${modelId}:`, parseErr instanceof Error ? parseErr.message : String(parseErr));
        return { flashcards: [], usage: result.usage };
      }
    } catch (err) {
      if (isAbortError(err)) {
        return { flashcards: [], usage: undefined };
      }
      throw err;
    } finally {
      timeout.cancel();
    }
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
  return NextResponse.json({ flashcards, usage, meta: { requestedCardsPerSection: cardsPerSection, usedCardsPerSection: targetCardsPerSection } });
}
