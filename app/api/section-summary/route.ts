import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { enforceOutputFormat } from "@/lib/format-output";
import { buildSectionSummaryPrompts } from "@/lib/study-prompts";
import type { DocumentSection, UsageStats } from "@/types";

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
  const { systemPrompt, userPrompt } = await buildSectionSummaryPrompts(sections, structure);
  const start = Date.now();

  const result = await generateText({
    model: openrouter(modelId) as any,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const summary = enforceOutputFormat(result.text, titleHint || undefined);
  const usage: UsageStats | null = buildUsageStats(result.usage, Date.now() - start, model, "section-summary");
  return NextResponse.json({ summary, usage });
}
