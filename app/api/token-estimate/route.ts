import { NextResponse } from "next/server";
import { loadModels } from "@/lib/models";
import { buildCostRows, countTokensByEncoding } from "@/lib/token-cost";
import { buildSummaryPrompts } from "@/lib/prompts";

export const runtime = "nodejs";

// Heuristic: output tokens = min(cap, round(inputTokens * ratio))
const OUTPUT_RATIO = 0.25;
const OUTPUT_CAP = 3000;

const estimateOutputTokens = (inputTokens: number): number => {
  return Math.min(OUTPUT_CAP, Math.round(inputTokens * OUTPUT_RATIO));
};

export async function POST(request: Request) {
  const body = await request.json();
  const extractedText = String(body.extractedText ?? "");
  const structureHints = String(body.structureHints ?? "");

  if (!extractedText) {
    return NextResponse.json({ error: "Missing extractedText" }, { status: 400 });
  }

  // Build the exact prompts used during generation (includes KI-Vorgaben guidelines)
  const { systemPrompt, userPrompt } = await buildSummaryPrompts(extractedText, structureHints);
  const fullPrompt = systemPrompt + "\n" + userPrompt;

  const models = await loadModels();
  const encodings = models.map((model) => model.tokenizer);
  const tokensByEncoding = await countTokensByEncoding(fullPrompt, encodings);

  // Calculate heuristic output tokens based on the average input tokens
  const avgInputTokens = Object.values(tokensByEncoding).reduce((a, b) => a + b, 0) / Object.keys(tokensByEncoding).length;
  const estimatedOutputTokens = estimateOutputTokens(avgInputTokens);

  const modelCosts = buildCostRows(models, tokensByEncoding, estimatedOutputTokens);

  return NextResponse.json({
    modelCosts,
    heuristic: {
      outputRatio: OUTPUT_RATIO,
      outputCap: OUTPUT_CAP,
      estimatedOutputTokens
    }
  });
}
