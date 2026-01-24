import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { buildFlashcardsPrompts } from "@/lib/study-prompts";
import { estimateFlashcardsPerSection } from "@/lib/study-heuristics";
import { parseJsonFromModelText } from "@/lib/parse-model-json";
import type { DocumentSection, Flashcard, UsageStats } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const adjustedEstimated = estimateFlashcardsPerSection(totalChars, coverageLevel);
  const cardsPerSection =
    Number.isFinite(nRaw) && nRaw > 0
      ? Math.max(1, Math.min(30, Math.floor(nRaw)))
      : adjustedEstimated;

  if (!modelId || sections.length === 0) {
    return NextResponse.json({ error: "Missing modelId or sections" }, { status: 400 });
  }

  const models = await loadModels();
  const model = models.find((item) => item.openrouterId === modelId) ?? null;
  const { systemPrompt, userPrompt } = await buildFlashcardsPrompts(sections, cardsPerSection);
  const start = Date.now();

  const result = await generateText({
    model: openrouter(modelId) as any,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const parsed = parseJsonFromModelText<FlashcardsResult>(result.text);
  const flashcards: Flashcard[] = [];
  for (const c of parsed.flashcards ?? []) {
    const sectionId = String(c.sectionId ?? "").trim();
    const sectionTitle = String(c.sectionTitle ?? "").trim() || sectionId;
    const type: Flashcard["type"] = c.type === "cloze" ? "cloze" : "qa";
    const front = String(c.front ?? "").trim();
    const back = String(c.back ?? "").trim();
    const sourceSnippet = String(c.sourceSnippet ?? "").trim();
    const page = typeof c.page === "number" ? c.page : undefined;

    if (!sectionId || !front || !back || !sourceSnippet) continue;

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

  const usage: UsageStats | null = buildUsageStats(result.usage, Date.now() - start, model, "flashcards");
  return NextResponse.json({ flashcards, usage });
}
