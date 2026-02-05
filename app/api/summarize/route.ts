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
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { validateTextSize } from "@/lib/request-validation";
import { validateTextLength, validateStructureHints, validateModelId } from "@/lib/utils/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_CALL_TIMEOUT_MS = 70_000;
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Handle POST summarization requests: validate input, generate a summary with the chosen model/key, record usage, and return the summary and usage metadata.
 *
 * @param request - Fetch Request whose JSON body must include `text` and `modelId`, and may include `structure` and `titleHint`.
 * @returns A JSON object with:
 * - `summary`: the processed summary string (starts with an H1 and contains no metadata),
 * - `usage`: generation token/cost statistics,
 * - `ownKeyInfo` (optional): `{ provider, costUsd, note }` when the user's own API key was used.
 *
 * Possible error responses include 400 for missing/invalid input or model, 403 for model access restrictions, 413 for oversized text, 429 for rate or monthly limits, and 504 for generation timeouts.
 */
export async function POST(request: Request) {
  const { userId: clerkUserId } = await auth();
  const userContext = await getUserContext();

  // Check rate limit for authenticated users (using Convex for persistence)
  if (userContext) {
    try {
      const rateLimit = await convex.mutation(api.rateLimits.checkRateLimit, {
        userId: userContext.userId,
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
      // If Convex call fails, log but allow request (fail open for availability)
      console.error("Rate limit check failed:", error);
      // Continue with request - rate limiting is a protection, not a blocker
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

  // Validate text size (byte size)
  const textValidation = validateTextSize(text);
  if (!textValidation.valid) {
    return NextResponse.json({ error: textValidation.error }, { status: 413 });
  }

  // Validate text length (character count)
  const textLengthValidation = validateTextLength(text);
  if (!textLengthValidation.valid) {
    return NextResponse.json({ error: textLengthValidation.error }, { status: 400 });
  }

  // Validate structure hints
  if (structure) {
    const structureValidation = validateStructureHints(structure);
    if (!structureValidation.valid) {
      return NextResponse.json({ error: structureValidation.error }, { status: 400 });
    }
  }

  // Validate model ID
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

  // Check if user has access to this model (subscription OR API key)
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

  // Check monthly usage limit
  if (userContext) {
    try {
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
      // Continue with generation if limit check fails (fail open)
    }
  }

  // Determine which API key to use (system key for subscription models, user key for own-cost models)
  const modelApiKeyInfo = getApiKeyForModel(modelId, userContext, model);
  const finalApiKey = modelApiKeyInfo?.key || apiKey;
  const isOwnKey = !!modelApiKeyInfo?.isOwnKey;

  // Debug logging (only when using own key)
  if (isOwnKey) {
    console.log(`[summarize] Using own ${modelApiKeyInfo?.provider || "openrouter"} key for ${modelId}`);
  }

  // Get user preferences for language and custom guidelines
  const userLanguage = userContext?.preferredLanguage || "en";
  const customGuidelines = userContext?.customGuidelines;
  const { systemPrompt, userPrompt } = await buildSummaryPrompts(text, structure, userLanguage, customGuidelines);
  const start = Date.now();

  let result: { text: string; usage: any; costInUsd?: number };
  const timeout = createTimeoutController(MODEL_CALL_TIMEOUT_MS);

  try {
    if (isOwnKey && modelApiKeyInfo) {
      // Use direct provider API for user's own key
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
      });
    } else {
      // Use OpenRouter (system key)
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

  // Post-process to enforce format (no metadata, starts with H1)
  const summary = enforceOutputFormat(result.text, titleHint || undefined);

  // Build usage stats
  const usage = buildUsageStats(result.usage, Date.now() - start, model, "summarize");

  // Save usage to Convex if user is authenticated
  if (clerkUserId) {
    try {
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
      // Don't fail the request if usage recording fails
    }
  }

  // Add own key info to response
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