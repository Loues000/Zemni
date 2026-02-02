import type { LanguageModelUsage } from "ai";

export type TimeoutController = {
  signal: AbortSignal;
  cancel: () => void;
};

/**
 * Determines if a model needs extended timeout and token limits.
 * Large/slow models (like 120B parameter models) need more time and tokens.
 */
export const getModelPerformanceConfig = (modelId: string): {
  timeoutMs: number;
  maxTokensMultiplier: number;
} => {
  // Models that are known to be slower/larger and need extended timeouts
  const slowModelPatterns = [
    "gpt-oss-120b",
    "gpt-oss-20b",
    "anthropic"
  ];

  const isSlowModel = slowModelPatterns.some(pattern => modelId.includes(pattern));

  if (isSlowModel) {
    return {
      timeoutMs: 180_000, // 180 seconds for large models
      maxTokensMultiplier: 1.5 // 50% more tokens for proper JSON generation
    };
  }

  return {
    timeoutMs: 45_000, // Default 45 seconds
    maxTokensMultiplier: 1.0
  };
};

export const createTimeoutController = (timeoutMs: number): TimeoutController => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(0, timeoutMs));
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId)
  };
};

export const isAbortError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const record = err as Record<string, unknown>;
  return record.name === "AbortError";
};

export const sumUsage = (usages: Array<LanguageModelUsage | undefined>): LanguageModelUsage | undefined => {
  type UsageTotals = { promptTokens: number; completionTokens: number; totalTokens: number };
  const totals = usages.reduce<UsageTotals>(
    (acc, u) => {
      acc.promptTokens += u?.promptTokens ?? 0;
      acc.completionTokens += u?.completionTokens ?? 0;
      acc.totalTokens += u?.totalTokens ?? 0;
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );

  if (totals.promptTokens === 0 && totals.completionTokens === 0 && totals.totalTokens === 0) {
    return undefined;
  }

  return totals;
};

export const splitTextIntoChunks = (
  text: string,
  chunkChars: number,
  {
    overlapChars = 250,
    maxChunks = 8
  }: { overlapChars?: number; maxChunks?: number } = {}
): string[] => {
  const normalized = (text ?? "").trim();
  if (!normalized) return [];
  if (normalized.length <= chunkChars) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length && chunks.length < maxChunks) {
    let end = Math.min(normalized.length, start + chunkChars);

    const searchStart = Math.min(normalized.length, start + Math.floor(chunkChars * 0.6));
    const window = normalized.slice(searchStart, end);
    const breakAt = window.lastIndexOf("\n\n");
    if (breakAt > 0) {
      end = searchStart + breakAt;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlapChars);
  }

  if (start < normalized.length && chunks.length > 0) {
    const tail = normalized.slice(start).trim();
    if (tail) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n\n...\n\n${tail}`.trim();
    }
  }

  return chunks;
};

export const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);

  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
};
