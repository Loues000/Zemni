import { NextResponse } from "next/server";
import { loadModels } from "@/lib/models";
import { buildCostRows, countTokensByEncoding } from "@/lib/token-cost";
import { buildFlashcardsPrompts, buildQuizPrompts, buildSectionSummaryPrompts } from "@/lib/study-prompts";
import type { DocumentSection, OutputKind } from "@/types";

export const runtime = "nodejs";

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const estimateOutputTokens = (
  avgInputTokens: number,
  mode: OutputKind,
  n: number | null,
  sectionsCount: number | null
): { outputRatio: number; outputCap: number; estimatedOutputTokens: number; note: string } => {
  if (mode === "summary") {
    const outputRatio = 0.25;
    const outputCap = 3000;
    const estimatedOutputTokens = Math.min(outputCap, Math.round(avgInputTokens * outputRatio));
    return {
      outputRatio,
      outputCap,
      estimatedOutputTokens,
      note: `Output estimate: min(${outputCap}, inputTokens x ${outputRatio})`
    };
  }

  const count = sectionsCount && sectionsCount > 0 ? sectionsCount : 1;
  const perSection = n && n > 0 ? n : 6;

  if (mode === "flashcards") {
    const outputRatio = 0.6;
    const outputCap = 9000;
    const minTokens = 300;
    const heuristic = count * perSection * 180;
    const estimatedOutputTokens = Math.min(outputCap, Math.max(minTokens, heuristic));
    return {
      outputRatio,
      outputCap,
      estimatedOutputTokens,
      note: `Output estimate: min(${outputCap}, max(${minTokens}, sections(${count}) x cardsPerSection(${perSection}) x 180))`
    };
  }

  if (mode === "quiz") {
    const outputRatio = 0.7;
    const outputCap = 9000;
    const minTokens = 400;
    const heuristic = count * perSection * 240;
    const estimatedOutputTokens = Math.min(outputCap, Math.max(minTokens, heuristic));
    return {
      outputRatio,
      outputCap,
      estimatedOutputTokens,
      note: `Output estimate: min(${outputCap}, max(${minTokens}, sections(${count}) x questions(${perSection}) x 240))`
    };
  }

  const outputRatio = 0.25;
  const outputCap = 3000;
  const estimatedOutputTokens = Math.min(outputCap, Math.round(avgInputTokens * outputRatio));
  return { outputRatio, outputCap, estimatedOutputTokens, note: `Output estimate: min(${outputCap}, inputTokens x ${outputRatio})` };
};

/**
 * Handle a POST request that builds prompts from provided text and returns model cost estimates and output-token heuristics.
 *
 * Expects the request JSON body to contain `extractedText` (string), and may include `structureHints` (string), `mode` ("summary" | "flashcards" | "quiz"), `n` (number), and `sectionsCount` (number).
 *
 * @param request - The incoming HTTP request whose JSON body supplies the input text and options.
 * @returns An object with `modelCosts` (cost rows for each loaded model) and `heuristic` (contains `outputRatio`, `outputCap`, `estimatedOutputTokens`, and `note`).
 *
 * Responds with a 400 status and `{ error: "Missing extractedText" }` if `extractedText` is empty or omitted.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const extractedText = String(body.extractedText ?? "");
  const structureHints = String(body.structureHints ?? "");
  const modeRaw = String(body.mode ?? "summary");
  const mode: OutputKind =
    modeRaw === "flashcards" || modeRaw === "quiz" || modeRaw === "summary" ? (modeRaw as OutputKind) : "summary";
  const n = body.n === null || body.n === undefined ? null : clampInt(body.n, 1, 30, 6);
  const sectionsCount = body.sectionsCount === null || body.sectionsCount === undefined ? null : clampInt(body.sectionsCount, 1, 500, 1);

  if (!extractedText) {
    return NextResponse.json({ error: "Missing extractedText" }, { status: 400 });
  }

  const section: DocumentSection = { id: "doc", title: "Selected", text: extractedText };
  let systemPrompt = "";
  let userPrompt = "";

  // Default to English for token estimation (no user context available)
  const defaultLanguage = "en";
  
  if (mode === "summary") {
    ({ systemPrompt, userPrompt } = await buildSectionSummaryPrompts([section], structureHints, defaultLanguage));
  } else if (mode === "flashcards") {
    ({ systemPrompt, userPrompt } = await buildFlashcardsPrompts([section], n ?? 6, defaultLanguage));
  } else {
    ({ systemPrompt, userPrompt } = await buildQuizPrompts(section, n ?? 6, [], defaultLanguage));
  }

  const fullPrompt = systemPrompt + "\n" + userPrompt;

  const models = await loadModels();
  const encodings = models.map((model) => model.tokenizer);
  const tokensByEncoding = await countTokensByEncoding(fullPrompt, encodings);

  // Calculate heuristic output tokens based on the average input tokens
  const avgInputTokens = Object.values(tokensByEncoding).reduce((a, b) => a + b, 0) / Object.keys(tokensByEncoding).length;
  const heuristic = estimateOutputTokens(avgInputTokens, mode, n, sectionsCount);

  const modelCosts = buildCostRows(models, tokensByEncoding, heuristic.estimatedOutputTokens);

  return NextResponse.json({
    modelCosts,
    heuristic
  });
}