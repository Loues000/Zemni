import { NextResponse } from "next/server";
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
import type { DocumentSection, QuizQuestion, UsageStats } from "@/types";

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
    console.log(`[quiz] Using own ${modelApiKeyInfo?.provider || "openrouter"} key for ${modelId}`);
  }

  const { systemPrompt, userPrompt } = await buildQuizPrompts(section, questionsCount, avoidQuestions);
  const start = Date.now();

  const perfConfig = getModelPerformanceConfig(modelId);
  const timeout = createTimeoutController(perfConfig.timeoutMs);
  const baseMaxTokens = Math.min(3200, Math.max(900, questionsCount * 220));
  const adjustedMaxTokens = Math.floor(baseMaxTokens * perfConfig.maxTokensMultiplier);

  let result: { text: string; usage: any };
  try {
    if (isOwnKey && modelApiKeyInfo) {
      // Use direct provider API for user's own key
      const apiKeys = userContext?.apiKeys.map(k => ({
        provider: k.provider,
        key: k.key || "",
        isOwnKey: k.useOwnKey,
      })) || [];

      const providerResult = await generateWithProvider(modelId, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], apiKeys, {
        maxTokens: adjustedMaxTokens,
        temperature: 0.2,
        maxRetries: 1,
      });
      result = {
        text: providerResult.text,
        usage: providerResult.usage,
      };
    } else {
      // Use OpenRouter (system key)
      const openrouterClient = createOpenRouterClient(finalApiKey);
      const genResult = await generateText({
        model: openrouterClient(modelId) as any,
        maxTokens: adjustedMaxTokens,
        temperature: 0.2,
        maxRetries: 1,
        abortSignal: timeout.signal,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });
      result = {
        text: genResult.text,
        usage: genResult.usage,
      };
    }
  } catch (err) {
    if (isAbortError(err)) {
      return NextResponse.json({ error: "Quiz generation timed out. Try a faster model or fewer questions." }, { status: 504 });
    }
    throw err;
  } finally {
    timeout.cancel();
  }

  let parsed: QuizResult;
  try {
    parsed = parseJsonFromModelText<QuizResult>(result.text);
  } catch (parseErr) {
    const errorMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.error(`[Quiz] JSON parse error for model ${modelId}:`, errorMsg);
    return NextResponse.json({
      error: `Model returned invalid JSON. ${errorMsg.length > 200 ? errorMsg.slice(0, 200) + "..." : errorMsg}`
    }, { status: 502 });
  }
  const questions: QuizQuestion[] = [];
  for (const q of parsed.questions ?? []) {
    const sectionId = String(q.sectionId ?? "").trim() || section.id;
    const sectionTitle = String(q.sectionTitle ?? "").trim() || section.title;
    const question = String(q.question ?? "").trim();
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
    const correctIndex = Number.isFinite(q.correctIndex) ? Math.floor(q.correctIndex) : -1;
    const explanation = q.explanation ? String(q.explanation).trim() : undefined;
    const sourceSnippet = String(q.sourceSnippet ?? "").trim();
    const page = typeof q.page === "number" ? q.page : section.page;

    if (!question || options.length !== 4 || correctIndex < 0 || correctIndex > 3 || !sourceSnippet) continue;

    questions.push({
      id: crypto.randomUUID(),
      sectionId,
      sectionTitle,
      question,
      options,
      correctIndex,
      explanation,
      sourceSnippet: sourceSnippet.length > 240 ? sourceSnippet.slice(0, 239) + "..." : sourceSnippet,
      page
    });
  }

  const usage: UsageStats | null = buildUsageStats(result.usage, Date.now() - start, model, "quiz");
  return NextResponse.json({ questions, usage });
}
