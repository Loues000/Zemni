import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { buildSummaryPrompts } from "@/lib/prompts";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { enforceOutputFormat } from "@/lib/format-output";
import { createTimeoutController, isAbortError } from "@/lib/ai-performance";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_CALL_TIMEOUT_MS = 70_000;

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "Missing OpenRouter key" }, { status: 400 });
  }

  const body = await request.json();
  const text = String(body.text ?? "");
  const modelId = String(body.modelId ?? "");
  const structure = String(body.structure ?? "");
  const titleHint = String(body.titleHint ?? "");

  if (!text || !modelId) {
    return NextResponse.json({ error: "Missing text or model" }, { status: 400 });
  }

  const models = await loadModels();
  const model = models.find((item) => item.openrouterId === modelId) ?? null;
  const { systemPrompt, userPrompt } = await buildSummaryPrompts(text, structure);
  const start = Date.now();

  const timeout = createTimeoutController(MODEL_CALL_TIMEOUT_MS);
  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
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
  } catch (err) {
    if (isAbortError(err)) {
      return NextResponse.json({ error: "Summary generation timed out. Try a faster model or shorter input." }, { status: 504 });
    }
    throw err;
  } finally {
    timeout.cancel();
  }

  // Post-process to enforce format (no metadata, starts with H1)
  const summary = enforceOutputFormat(result.text, titleHint || undefined);

  const usage = buildUsageStats(result.usage, Date.now() - start, model, "summarize");
  return NextResponse.json({ summary, usage });
}
