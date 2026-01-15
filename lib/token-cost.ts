import type { ModelSpec } from "./models";

export type CostRow = {
  id: string;
  name: string;
  provider: string;
  tokenizer: string;
  tokensIn: number;
  tokensOut: number;
  costIn: number | null;
  costOut: number | null;
  total: number | null;
  currency: string;
  inPer1m: number | null;
  outPer1m: number | null;
};

export const countTokens = async (text: string, encoding: string): Promise<number> => {
  const { get_encoding } = await import("@dqbd/tiktoken");
  let encoder;
  try {
    encoder = get_encoding(encoding as any);
  } catch {
    encoder = get_encoding("cl100k_base");
  }
  const tokens = encoder.encode(text);
  encoder.free();
  return tokens.length;
};

export const countTokensByEncoding = async (
  text: string,
  encodings: string[]
): Promise<Record<string, number>> => {
  const unique = Array.from(new Set(encodings));
  const results = await Promise.all(
    unique.map(async (encoding) => {
      const tokens = await countTokens(text, encoding);
      return [encoding, tokens] as const;
    })
  );
  return Object.fromEntries(results);
};

export const buildCostRows = (
  models: ModelSpec[],
  tokensByEncoding: Record<string, number>,
  outputTokens = 0
): CostRow[] => {
  return models.map((model) => {
    const tokensIn = tokensByEncoding[model.tokenizer] ?? 0;
    const tokensOut = Math.max(0, Math.trunc(outputTokens));
    const costIn =
      model.pricing.input_per_1m === null
        ? null
        : (tokensIn / 1_000_000) * model.pricing.input_per_1m;
    const costOut =
      model.pricing.output_per_1m === null
        ? null
        : (tokensOut / 1_000_000) * model.pricing.output_per_1m;
    const total = costIn !== null || costOut !== null ? (costIn ?? 0) + (costOut ?? 0) : null;

    return {
      id: model.openrouterId,
      name: model.name,
      provider: model.provider,
      tokenizer: model.tokenizer,
      tokensIn,
      tokensOut,
      costIn,
      costOut,
      total,
      currency: model.pricing.currency,
      inPer1m: model.pricing.input_per_1m,
      outPer1m: model.pricing.output_per_1m
    };
  });
};
