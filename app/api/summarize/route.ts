import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenRouterClient } from "@/lib/openrouter";
import { buildSummaryPrompts } from "@/lib/prompts";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { enforceOutputFormat } from "@/lib/format-output";
import { createTimeoutController, isAbortError } from "@/lib/ai-performance";
import { getUserContext, checkModelAvailability, getApiKeyToUse } from "@/lib/api-helpers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_CALL_TIMEOUT_MS = 70_000;
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  const userContext = await getUserContext();
  const apiKey = getApiKeyToUse(userContext);

  if (!apiKey) {
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

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 400 });
  }

  // Check if user has access to this model
  if (userContext && !checkModelAvailability(model, userContext.userTier)) {
    return NextResponse.json(
      { error: "This model is not available for your subscription tier" },
      { status: 403 }
    );
  }

  // Get user preferences for language and custom guidelines
  const userLanguage = userContext?.preferredLanguage || "en";
  const customGuidelines = userContext?.customGuidelines;
  const { systemPrompt, userPrompt } = await buildSummaryPrompts(text, structure, userLanguage, customGuidelines);
  const start = Date.now();

  const openrouterClient = createOpenRouterClient(apiKey);
  const timeout = createTimeoutController(MODEL_CALL_TIMEOUT_MS);
  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: openrouterClient(modelId) as any,
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

  // Save usage to Convex if user is authenticated
  if (userContext && usage) {
    try {
      await convex.mutation(api.usage.recordUsage, {
        source: "summarize",
        tokensIn: result.usage?.promptTokens || 0,
        tokensOut: result.usage?.completionTokens || 0,
        cost: usage.costTotal || 0,
        modelId: modelId,
      });
    } catch (err) {
      console.error("Failed to record usage:", err);
      // Don't fail the request if usage recording fails
    }
  }

  return NextResponse.json({ summary, usage });
}
