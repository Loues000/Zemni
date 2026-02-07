import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { createOpenRouterClient } from "@/lib/openrouter";
import { buildSummaryPrompts } from "@/lib/prompts";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { enforceOutputFormat } from "@/lib/format-output";
import { createTimeoutController, isAbortError } from "@/lib/ai-performance";
import { getUserContext, checkModelAvailability, getApiKeyToUse, getApiKeyForModel } from "@/lib/api-helpers";
import { generateWithProvider, type ProviderInfo } from "@/lib/providers";
import { isModelAvailable } from "@/lib/models";
import { api } from "@/convex/_generated/api";
import { validateTextSize } from "@/lib/request-validation";
import { validateTextLength, validateStructureHints, validateModelId } from "@/lib/utils/validation";
import { getConvexClient } from "@/lib/convex-server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_CALL_TIMEOUT_MS = 70_000;

export async function POST(request: Request) {
  const { userId: clerkUserId } = await auth();
  const userContext = await getUserContext();

  if (userContext && clerkUserId) {
    try {
      const convex = getConvexClient();
      const rateLimit = await convex.mutation(api.rateLimits.checkRateLimit, {
        clerkUserId,
        type: "generation",
      });
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later.", retryAfter: rateLimit.retryAfter },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimit.retryAfter || 3600),
            },
          }
        );
      }
    } catch (error) {
      console.error("Rate limit check failed:", error);
    }
  }

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

  const textValidation = validateTextSize(text);
  if (!textValidation.valid) {
    return NextResponse.json({ error: textValidation.error }, { status: 413 });
  }

  const textLengthValidation = validateTextLength(text);
  if (!textLengthValidation.valid) {
    return NextResponse.json({ error: textLengthValidation.error }, { status: 400 });
  }

  if (structure) {
    const structureValidation = validateStructureHints(structure);
    if (!structureValidation.valid) {
      return NextResponse.json({ error: structureValidation.error }, { status: 400 });
    }
  }

  const modelValidation = await validateModelId(modelId);
  if (!modelValidation.valid) {
    return NextResponse.json({ error: modelValidation.error }, { status: 400 });
  }

  const models = await loadModels();
  const model = models.find((item) => item.openrouterId === modelId) ?? null;

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 400 });
  }

  const allowUnlimitedOutput = model.pricing.output_per_1m === 0;

  const hasModelAccess = checkModelAvailability(
    { id: model.openrouterId, subscriptionTier: model.subscriptionTier },
    userContext
  );

  if (!hasModelAccess) {
    return NextResponse.json(
      { error: "This model is not available for your subscription tier. Add an API key in settings to use higher tier models." },
      { status: 403 }
    );
  }

  if (userContext) {
    try {
      const convex = getConvexClient();
      const monthlyUsage = await convex.query(api.usage.getMonthlyGenerationCount, {});
      if (monthlyUsage.count >= monthlyUsage.limit) {
        return NextResponse.json(
          {
            error: `Monthly limit reached (${monthlyUsage.count}/${monthlyUsage.limit} generations). Upgrade your plan for more generations.`,
            limitReached: true,
            currentCount: monthlyUsage.count,
            limit: monthlyUsage.limit,
          },
          { status: 429 }
        );
      }
    } catch (err) {
      console.error("Failed to check usage limit:", err);
    }
  }

  const modelApiKeyInfo = getApiKeyForModel(modelId, userContext, model);
  const finalApiKey = modelApiKeyInfo?.key || apiKey;
  const isOwnKey = !!modelApiKeyInfo?.isOwnKey;

  if (isOwnKey) {
    console.log(`[summarize] Using own ${modelApiKeyInfo?.provider || "openrouter"} key for ${modelId}`);
  }

  const userLanguage = userContext?.preferredLanguage || "en";
  const customGuidelines = userContext?.customGuidelines;
  const { systemPrompt, userPrompt } = await buildSummaryPrompts(text, structure, userLanguage, customGuidelines);
  const start = Date.now();

  let result: { text: string; usage: any; costInUsd?: number };
  const timeout = createTimeoutController(MODEL_CALL_TIMEOUT_MS);

  try {
    if (isOwnKey && modelApiKeyInfo) {
      const providerInfo: ProviderInfo = {
        provider: modelApiKeyInfo.provider,
        key: modelApiKeyInfo.key,
        isOwnKey: true,
      };

      const apiKeys = userContext?.apiKeys.map(k => ({
        provider: k.provider,
        key: k.key || "",
        isOwnKey: k.useOwnKey,
      })) || [];

      result = await generateWithProvider(modelId, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ], apiKeys, {
        maxTokens: allowUnlimitedOutput ? undefined : 2800,
        temperature: 0.2,
        maxRetries: 1,
        signal: timeout.signal,
      });
    } else {
      const openrouterClient = createOpenRouterClient(finalApiKey);
      const genResult = await generateText({
        model: openrouterClient(modelId) as any,
        maxTokens: allowUnlimitedOutput ? undefined : 2800,
        temperature: 0.2,
        maxRetries: 1,
        abortSignal: timeout.signal,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      result = {
        text: genResult.text,
        usage: genResult.usage,
      };
    }
  } catch (err) {
    if (isAbortError(err)) {
      return NextResponse.json({ error: "Summary generation timed out. Try a faster model or shorter input." }, { status: 504 });
    }
    throw err;
  } finally {
    timeout.cancel();
  }

  const summary = enforceOutputFormat(result.text, titleHint || undefined);

  const usage = buildUsageStats(result.usage, Date.now() - start, model, "summarize");

  if (clerkUserId) {
    try {
      const convex = getConvexClient();
      await convex.mutation(api.usage.recordUsage, {
        source: "summarize",
        tokensIn: result.usage?.promptTokens || 0,
        tokensOut: result.usage?.completionTokens || 0,
        cost: usage?.costTotal || 0,
        modelId: modelId,
        clerkUserId: clerkUserId,
      });
    } catch (err) {
      console.error("Failed to record usage:", err);
    }
  }

  const response: any = { summary, usage };
  if (isOwnKey) {
    response.ownKeyInfo = {
      provider: modelApiKeyInfo?.provider,
      costUsd: result.costInUsd,
      note: "Charges apply to your API account",
    };
  }

  return NextResponse.json(response);
}
