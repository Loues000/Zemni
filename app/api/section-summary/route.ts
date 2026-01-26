import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { enforceOutputFormat } from "@/lib/format-output";
import { buildChunkNotesPrompts, buildSectionSummaryPrompts } from "@/lib/study-prompts";
import { createTimeoutController, isAbortError, mapWithConcurrency, splitTextIntoChunks, sumUsage } from "@/lib/ai-performance";
import type { DocumentSection, UsageStats } from "@/types";
import type { LanguageModelUsage } from "ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const NOTES_CHUNK_CHARS = 12_000;
const NOTES_CHUNK_OVERLAP_CHARS = 350;
const NOTES_MAX_CHUNKS_PER_SECTION = 8;
const NOTES_CONCURRENCY = 3;
const NOTES_CALL_TIMEOUT_MS = 30_000;
const FINAL_CALL_TIMEOUT_MS = 70_000;
const CHUNKING_THRESHOLD_CHARS = 28_000;

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
  if (!process.env.OPENROUTER_API_KEY) {
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
  const start = Date.now();

  const totalChars = sections.reduce((acc, s) => acc + (s.text?.length ?? 0), 0);

  const shouldChunk =
    totalChars > CHUNKING_THRESHOLD_CHARS ||
    sections.some((s) => (s.text?.length ?? 0) > CHUNKING_THRESHOLD_CHARS);

  const usages: Array<LanguageModelUsage | undefined> = [];

  const summarizeDirect = async (): Promise<{ text: string; usage: LanguageModelUsage | undefined }> => {
    const { systemPrompt, userPrompt } = await buildSectionSummaryPrompts(sections, structure);
    const timeout = createTimeoutController(FINAL_CALL_TIMEOUT_MS);
    try {
      const result = await generateText({
        model: openrouter(modelId) as any,
        maxTokens: 2800,
        temperature: 0.2,
        maxRetries: 1,
        abortSignal: timeout.signal,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });
      return { text: result.text, usage: result.usage };
    } finally {
      timeout.cancel();
    }
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
      const timeout = createTimeoutController(NOTES_CALL_TIMEOUT_MS);
      try {
        const result = await generateText({
          model: openrouter(modelId) as any,
          maxTokens: 950,
          temperature: 0.2,
          maxRetries: 1,
          abortSignal: timeout.signal,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        });
        return { section: noteSection, notes: result.text, usage: result.usage };
      } catch (err) {
        if (isAbortError(err)) {
          return { section: noteSection, notes: "", usage: undefined };
        }
        throw err;
      } finally {
        timeout.cancel();
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
    const timeout = createTimeoutController(FINAL_CALL_TIMEOUT_MS);
    try {
      const result = await generateText({
        model: openrouter(modelId) as any,
        maxTokens: 2800,
        temperature: 0.2,
        maxRetries: 1,
        abortSignal: timeout.signal,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });
      return { text: result.text, usage: result.usage };
    } finally {
      timeout.cancel();
    }
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
    throw err;
  }
}
