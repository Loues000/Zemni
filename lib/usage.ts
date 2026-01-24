import type { LanguageModelUsage } from "ai";
import type { ModelSpec } from "./models";

export type UsageStats = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  tokensPerSecond: number | null;
  costIn: number | null;
  costOut: number | null;
  costTotal: number | null;
  currency: string | null;
  source: "summarize" | "refine" | "section-summary" | "flashcards" | "quiz";
};

export const buildUsageStats = (
  usage: LanguageModelUsage | undefined,
  durationMs: number | null,
  model: ModelSpec | null,
  source: UsageStats["source"]
): UsageStats | null => {
  if (!usage) {
    return null;
  }

  const promptTokens = usage.promptTokens ?? null;
  const completionTokens = usage.completionTokens ?? null;
  const totalTokens = usage.totalTokens ?? null;

  const seconds = durationMs && durationMs > 0 ? durationMs / 1000 : null;
  const tokensPerSecond =
    seconds && completionTokens !== null ? completionTokens / seconds : null;

  const inputRate = model?.pricing.input_per_1m ?? null;
  const outputRate = model?.pricing.output_per_1m ?? null;
  const costIn =
    inputRate !== null && promptTokens !== null
      ? (promptTokens / 1_000_000) * inputRate
      : null;
  const costOut =
    outputRate !== null && completionTokens !== null
      ? (completionTokens / 1_000_000) * outputRate
      : null;
  const costTotal = costIn !== null || costOut !== null ? (costIn ?? 0) + (costOut ?? 0) : null;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    durationMs,
    tokensPerSecond,
    costIn,
    costOut,
    costTotal,
    currency: model?.pricing.currency ?? null,
    source
  };
};
