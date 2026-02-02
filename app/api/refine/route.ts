 import { NextResponse } from "next/server";
import { StreamData, streamText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { buildRefineSystemPrompt } from "@/lib/prompts";
import { loadModels } from "@/lib/models";
import { getUserContext, checkModelAvailability, getApiKeyToUse, getApiKeyForModel } from "@/lib/api-helpers";
import { createOpenRouterClient } from "@/lib/openrouter";
import { isModelAvailable } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userContext = await getUserContext();
  const apiKey = getApiKeyToUse(userContext);

  if (!apiKey) {
    return NextResponse.json({ error: "Missing OpenRouter key" }, { status: 400 });
  }

  const body = await request.json();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const summary = String(body.summary ?? "");
  const modelId = String(body.modelId ?? "");

  if (!summary || !modelId) {
    return NextResponse.json({ error: "Missing summary or model" }, { status: 400 });
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
  
  // Debug logging (only when using own key)
  if (isOwnKey) {
    console.log(`[refine] Using own ${modelApiKeyInfo?.provider || "openrouter"} key for ${modelId}`);
  }

  // For streaming, we use OpenRouter client (works for both system and user OpenRouter keys)
  // If user has own key with OpenRouter provider, use that; otherwise use system key
  const openrouterClient = createOpenRouterClient(finalApiKey);
  const systemPrompt = await buildRefineSystemPrompt(summary);
  const data = new StreamData();
  const start = Date.now();
  const result = await streamText({
    model: openrouterClient(modelId) as any,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    onFinish: (event) => {
      const usage = buildUsageStats(event.usage, Date.now() - start, model, "refine");
      if (usage) {
        data.append({ type: "usage", payload: usage });
      }
      void data.close();
    }
  });

  return result.toDataStreamResponse({ data });
}
