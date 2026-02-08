import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";
import { buildQuizPrompts } from "@/lib/study-prompts";
import { parseJsonFromModelText } from "@/lib/parse-model-json";
import { createTimeoutController, isAbortError, getModelPerformanceConfig } from "@/lib/ai-performance";
import { getUserContext, checkModelAvailability, getApiKeyToUse, getApiKeyForModel } from "@/lib/api-helpers";
import { isModelAvailable } from "@/lib/models";
import { createOpenRouterClient } from "@/lib/openrouter";
import { generateWithProvider, type ProviderInfo } from "@/lib/providers";
import { api } from "@/convex/_generated/api";
import { validateModelId, validateQuestionsCount } from "@/lib/utils/validation";
import type { DocumentSection, QuizQuestion, UsageStats } from "@/types";
import { getConvexClient } from "@/lib/convex-server";

export const runtime = "nodejs";
export const maxDuration = 300;
const toSection = (value: unknown): DocumentSection | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id ?? "").trim();
  const title = String(record.title ?? "").trim();
  const text = String(record.text ?? "");
  const pageValue = record.page;
  const page = typeof pageValue === "number" ? pageValue : undefined;
  if (!id || !text.trim()) return null;
  return { id, title: title || id, text, page };
};

type ModelQuizQuestion = {
  sectionId: string;
  sectionTitle: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  sourceSnippet: string;
  page?: number;
};

type QuizResult = {
  questions: ModelQuizQuestion[];
};
export async function POST(request: Request) {
  const { userId: clerkUserId, getToken } = await auth();
  const userContext = await getUserContext();
  const apiKey = getApiKeyToUse(userContext);

  if (!apiKey) {
    return NextResponse.json({ error: "Missing OpenRouter key" }, { status: 400 });
  }

  const body = await request.json();
  const section = toSection(body.section);
  const modelId = String(body.modelId ?? "");
  const nRaw = Number(body.questionsCount ?? body.n ?? 0);
  const questionsCount =
    Number.isFinite(nRaw) && nRaw > 0
      ? Math.max(1, Math.min(30, Math.floor(nRaw)))
      : 6;
  const avoidQuestions = Array.isArray(body.avoidQuestions)
    ? body.avoidQuestions.map((q: unknown) => String(q ?? "").trim()).filter((q: string) => q.length > 0).slice(0, 50)
    : [];

  if (!modelId || !section) {
    return NextResponse.json({ error: "Missing modelId or section" }, { status: 400 });
  }

  const modelValidation = await validateModelId(modelId);
  if (!modelValidation.valid) {
    return NextResponse.json({ error: modelValidation.error }, { status: 400 });
  }

  const questionsCountValidation = validateQuestionsCount(questionsCount, 30);
  if (!questionsCountValidation.valid) {
    return NextResponse.json({ error: questionsCountValidation.error }, { status: 400 });
  }

  if (!section.id || !section.text || section.text.trim().length === 0) {
    return NextResponse.json(
      { error: "Section is invalid: must have id and non-empty text" },
      { status: 400 }
    );
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
      const convexToken = await getToken({ template: "convex" });
      if (!convexToken) {
        console.warn("[quiz] Missing Convex auth token; skipping usage check.");
      } else {
        convex.setAuth(convexToken);
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
      }
    } catch (err) {
      console.error("Failed to check usage limit:", err);
    }
  }

  const modelApiKeyInfo = getApiKeyForModel(modelId, userContext, model);
  const finalApiKey = modelApiKeyInfo?.key || apiKey;
  const isOwnKey = !!modelApiKeyInfo?.isOwnKey;

  if (isOwnKey) {
    console.log(`[quiz] Using own ${modelApiKeyInfo?.provider || "openrouter"} key for ${modelId}`);
  }

  const userLanguage = userContext?.preferredLanguage || "en";
  const customGuidelines = userContext?.customGuidelines;

  const start = Date.now();
  const perfConfig = getModelPerformanceConfig(modelId);

  const generateQuiz = async (retryCount: number = 0): Promise<{ questions: QuizQuestion[]; usage: any }> => {
    const { systemPrompt, userPrompt } = await buildQuizPrompts(section, questionsCount, avoidQuestions, userLanguage, customGuidelines);

    const currentQuestionsCount = retryCount < 2 ? questionsCount : Math.max(1, Math.floor(questionsCount * 0.7));

    const enhancedSystemPrompt = retryCount > 0
      ? `${systemPrompt}\n\nCRITICAL: Output ONLY valid JSON. No markdown, no code fences, no explanations. The JSON must be parseable. Ensure all strings are properly escaped and closed.`
      : systemPrompt;

    const timeout = createTimeoutController(perfConfig.timeoutMs * (retryCount + 1));
    try {
      const baseMaxTokens = Math.min(3200, Math.max(1200, currentQuestionsCount * 250));
      let adjustedMaxTokens = Math.floor(baseMaxTokens * perfConfig.maxTokensMultiplier);

      if (retryCount > 0) adjustedMaxTokens = Math.floor(adjustedMaxTokens * 1.5);

      let result: { text: string; usage: any };
      const maxTokens = allowUnlimitedOutput ? undefined : adjustedMaxTokens;

      if (isOwnKey && modelApiKeyInfo) {
        const apiKeys = userContext?.apiKeys.map(k => ({
          provider: k.provider,
          key: k.key || "",
          isOwnKey: k.useOwnKey,
        })) || [];

        const providerResult = await generateWithProvider(modelId, [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: userPrompt }
        ], apiKeys, {
          maxTokens,
          temperature: 0.2,
          maxRetries: 1,
          signal: timeout.signal,
        });
        result = {
          text: providerResult.text,
          usage: providerResult.usage,
        };
      } else {
        const openrouterClient = createOpenRouterClient(finalApiKey);
        const genResult = await generateText({
          model: openrouterClient(modelId) as any,
          maxTokens,
          temperature: 0.2,
          maxRetries: 1,
          abortSignal: timeout.signal,
          messages: [
            { role: "system", content: enhancedSystemPrompt },
            { role: "user", content: userPrompt }
          ]
        });
        result = {
          text: genResult.text,
          usage: genResult.usage,
        };
      }

      if (!result.text || result.text.trim().length < 10) {
        if (retryCount < 2) {
          console.warn(`[Quiz] Empty response from ${modelId}, retrying (${retryCount + 1})...`);
          timeout.cancel();
          return generateQuiz(retryCount + 1);
        }
      }

      try {
        const parsed = parseJsonFromModelText<QuizResult>(result.text);

        const questions: QuizQuestion[] = [];
        for (const q of parsed.questions ?? []) {
          const sId = String(q.sectionId ?? "").trim() || section.id;
          const sTitle = String(q.sectionTitle ?? "").trim() || section.title;
          const question = String(q.question ?? "").trim();
          const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
          const correctIndex = Number.isFinite(q.correctIndex) ? Math.floor(q.correctIndex) : -1;
          const explanation = q.explanation ? String(q.explanation).trim() : undefined;
          const sourceSnippet = String(q.sourceSnippet ?? "").trim();
          const page = typeof q.page === "number" ? q.page : section.page;

          if (!question || options.length !== 4 || correctIndex < 0 || correctIndex > 3 || !sourceSnippet) continue;

          questions.push({
            id: crypto.randomUUID(),
            sectionId: sId,
            sectionTitle: sTitle,
            question,
            options,
            correctIndex,
            explanation,
            sourceSnippet: sourceSnippet.length > 240 ? sourceSnippet.slice(0, 239) + "..." : sourceSnippet,
            page
          });
        }

        if (questions.length === 0 && retryCount < 1) {
          console.warn(`[Quiz] No valid questions from ${modelId}, retrying...`);
          timeout.cancel();
          return generateQuiz(retryCount + 1);
        }

        return { questions, usage: result.usage };
      } catch (parseErr) {
        const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        const isTruncated = errMsg.includes("truncated") || errMsg.includes("Expected ',' or ']'") || errMsg.includes("Unexpected end");

        if (retryCount < 2) {
          console.warn(`[Quiz] JSON parse error (${isTruncated ? "truncated" : "malformed"}) for model ${modelId}, retrying (${retryCount + 1})...`);
          timeout.cancel();
          return generateQuiz(retryCount + 1);
        }

        console.error(`[Quiz] JSON parse error for model ${modelId} after retry:`, errMsg);
        return { questions: [], usage: result.usage };
      }
    } catch (err) {
      if (isAbortError(err)) {
        if (retryCount < 1) {
          console.warn(`[Quiz] Timeout for model ${modelId}, retrying with longer timeout...`);
          return generateQuiz(retryCount + 1);
        }
        return { questions: [], usage: undefined };
      }
      throw err;
    } finally {
      timeout.cancel();
    }
  };

  const { questions, usage: usageAgg } = await generateQuiz();
  const usage: UsageStats | null = buildUsageStats(usageAgg, Date.now() - start, model, "quiz");

  if (clerkUserId) {
    try {
      const convex = getConvexClient();
      await convex.mutation(api.usage.recordUsage, {
        source: "quiz",
        tokensIn: usageAgg?.promptTokens || 0,
        tokensOut: usageAgg?.completionTokens || 0,
        cost: usage?.costTotal || 0,
        modelId: modelId,
        clerkUserId: clerkUserId,
      });
    } catch (err) {
      console.error("Failed to record usage:", err);
    }
  }

  return NextResponse.json({ questions, usage });
}
