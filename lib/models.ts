import fs from "fs/promises";
import path from "path";

export type Pricing = {
  currency: string;
  input_per_1m: number | null;
  output_per_1m: number | null;
};

export type ModelSpec = {
  name: string;
  provider: string;
  displayName?: string;
  tokenizer: string;
  pricing: Pricing;
  openrouterId: string;
};

const DEFAULT_MODELS: ModelSpec[] = [
  {
    name: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    tokenizer: "o200k_base",
    pricing: { currency: "USD", input_per_1m: null, output_per_1m: null },
    openrouterId: "openai/gpt-4o"
  }
];

const MODELS_DIR = path.join(process.cwd(), "config");
const MODEL_FILES = [
  "openrouter-models.json",
  "openrouter-models.prices.json",
  "openrouter-models.example.json",
  "models.json",
  "models.prices.json",
  "models.example.json"
];

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const parseModelsJson = (data: unknown): ModelSpec[] => {
  if (!Array.isArray(data)) {
    throw new Error("models JSON must be a list");
  }

  return data.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`models[${index}] must be an object`);
    }
    const record = raw as Record<string, unknown>;
    
    // Support combined id field (provider/name) or separate fields
    let name: string;
    let provider: string;
    let openrouterId: string;
    
    const combinedId = String(record.id ?? record.openrouter_id ?? "").trim();
    if (combinedId) {
      // Extract provider and name from combined id (e.g., "openai/gpt-4o")
      const parts = combinedId.split("/");
      if (parts.length !== 2) {
        throw new Error(`models[${index}].id must be in format "provider/name"`);
      }
      provider = parts[0].trim();
      name = parts[1].trim();
      openrouterId = combinedId;
    } else {
      // Fall back to separate name and provider fields
      name = String(record.name ?? "").trim();
      provider = String(record.provider ?? "unknown").trim() || "unknown";
      openrouterId = String(record.openrouter_id ?? `${provider}/${name}`).trim();
    }

    if (!name) {
      throw new Error(`models[${index}] must have either "id" (provider/name) or "name" field`);
    }

    const displayName = record.display_name ? String(record.display_name).trim() : undefined;
    const tokenizer = record.tokenizer as Record<string, unknown> | undefined;
    const tokenizerEncoding = String(tokenizer?.tiktoken_encoding ?? "cl100k_base").trim() || "cl100k_base";

    const pricingRaw = record.pricing as Record<string, unknown> | undefined;
    const currency = String(pricingRaw?.currency ?? "USD").trim() || "USD";

    return {
      name,
      provider,
      displayName: displayName || `${provider}/${name}`,
      tokenizer: tokenizerEncoding,
      pricing: {
        currency,
        input_per_1m: toNumber(pricingRaw?.input_per_1m),
        output_per_1m: toNumber(pricingRaw?.output_per_1m)
      },
      openrouterId
    };
  });
};

const resolveModelsFile = async (): Promise<string | null> => {
  for (const filename of MODEL_FILES) {
    const candidate = path.join(MODELS_DIR, filename);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // ignore
    }
  }
  return null;
};

export const loadModels = async (): Promise<ModelSpec[]> => {
  const modelsFile = await resolveModelsFile();
  if (!modelsFile) {
    return DEFAULT_MODELS;
  }
  const raw = await fs.readFile(modelsFile, "utf8");
  return parseModelsJson(JSON.parse(raw));
};
