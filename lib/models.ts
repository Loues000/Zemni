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
  subscriptionTier?: string;
};

const DEFAULT_MODELS: ModelSpec[] = [
  {
    name: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    tokenizer: "o200k_base",
    pricing: { currency: "USD", input_per_1m: null, output_per_1m: null },
    openrouterId: "openai/gpt-4o",
    subscriptionTier: "plus"
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

/**
 * Determines if a model is available for the current user based on subscription tier
 * 
 * @param model - The model to check
 * @param userTier - Current user's subscription tier (null = not logged in, "free" = logged in no sub, "basic" = basic sub, "plus" = plus sub, "pro" = pro sub)
 * @returns true if the model is available, false otherwise
 */
export const isModelAvailable = (
  model: { subscriptionTier?: string },
  userTier: string | null = null
): boolean => {
  const modelTier = model.subscriptionTier;

  // If model has no tier, make it available (fallback)
  if (!modelTier) {
    return true;
  }

  // Not logged in: only free tier models
  if (userTier === null) {
    return modelTier === "free";
  }

  // Logged in, no subscription: free tier models
  if (userTier === "free") {
    return modelTier === "free";
  }

  // Basic subscription: free and basic tier models
  if (userTier === "basic") {
    return modelTier === "free" || modelTier === "basic";
  }

  // Plus subscription: free, basic, and plus tier models
  if (userTier === "plus") {
    return modelTier === "free" || modelTier === "basic" || modelTier === "plus";
  }

  // Pro subscription: all models
  if (userTier === "pro") {
    return true;
  }

  // Fallback
  return modelTier === "free";
};

/**
 * Sorts models by subscription tier, then alphabetically by display name
 */
const sortModelsByTier = (models: ModelSpec[]): ModelSpec[] => {
  const tierOrder = ["free", "basic", "plus", "pro"];

  const getTierOrder = (tier?: string): number => {
    if (!tier) return 999; // Unknown tiers go to the end
    const index = tierOrder.indexOf(tier.toLowerCase());
    return index === -1 ? 999 : index;
  };

  return [...models].sort((a, b) => {
    const tierA = a.subscriptionTier || "";
    const tierB = b.subscriptionTier || "";
    const tierDiff = getTierOrder(tierA) - getTierOrder(tierB);

    if (tierDiff !== 0) {
      return tierDiff;
    }

    // Within same tier, sort alphabetically by display name
    const nameA = a.displayName || a.name;
    const nameB = b.displayName || b.name;
    return nameA.localeCompare(nameB);
  });
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

    const pricing: Pricing = {
      currency,
      input_per_1m: toNumber(pricingRaw?.input_per_1m),
      output_per_1m: toNumber(pricingRaw?.output_per_1m)
    };

    // Read subscription_tier directly from JSON (required field)
    const subscriptionTier = record.subscription_tier ? String(record.subscription_tier).trim() : undefined;

    if (!subscriptionTier) {
      throw new Error(`models[${index}] must have "subscription_tier" field (free, basic, plus, or pro)`);
    }

    const modelSpec: ModelSpec = {
      name,
      provider,
      displayName: displayName || `${provider}/${name}`,
      tokenizer: tokenizerEncoding,
      pricing,
      openrouterId,
      subscriptionTier
    };

    return modelSpec;
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

/**
 * Checks if subscription tiers feature is enabled via environment variable
 */
const isSubscriptionTiersEnabled = (): boolean => {
  if (typeof process !== "undefined" && process.env) {
    const value = process.env.NEXT_PUBLIC_ENABLE_SUBSCRIPTION_TIERS;
    return value === "true" || value === "1";
  }
  return false;
};

export const loadModels = async (): Promise<ModelSpec[]> => {
  const modelsFile = await resolveModelsFile();
  let models: ModelSpec[];

  if (!modelsFile) {
    models = DEFAULT_MODELS;
  } else {
    const raw = await fs.readFile(modelsFile, "utf8");
    models = parseModelsJson(JSON.parse(raw));
  }

  // Sort by tier if feature is enabled
  const tiersEnabled = isSubscriptionTiersEnabled();

  if (tiersEnabled) {
    models = sortModelsByTier(models);
  }

  return models;
};

// Export for use in API routes
export { isSubscriptionTiersEnabled };
