/**
 * Client-safe model availability logic with API key support.
 * This file contains NO Node.js imports (fs/path) and can be imported by client components.
 */

export type ApiProvider = "openrouter" | "openai" | "anthropic" | "google";

export interface ModelAvailability {
  isAvailable: boolean;
  isCoveredBySubscription: boolean;
  requiresOwnKey: boolean;
  reason: "subscription" | "api_key" | "locked";
}

/**
 * Determines the API provider indicated by a model identifier of the form "provider/model".
 *
 * @param modelId - Model identifier where the provider is the segment before the first "/" (e.g., "openai/gpt-4")
 * @returns The matching ApiProvider ("openrouter", "openai", "anthropic", or "google") if recognized, `null` otherwise.
 */
export function getProviderFromModelId(modelId: string): ApiProvider | null {
  const parts = modelId.split("/");
  if (parts.length < 2) return null;
  
  const provider = parts[0].toLowerCase();
  
  if (provider === "openai") return "openai";
  if (provider === "anthropic") return "anthropic";
  if (provider === "google") return "google";
  if (provider === "openrouter" || provider === "x-ai" || provider === "mistral" || 
      provider === "meta" || provider === "nvidia" || provider === "microsoft" ||
      provider === "amazon" || provider === "cohere") {
    // These providers are accessed via OpenRouter
    return "openrouter";
  }
  
  return null;
}

/**
 * Core logic to determine if a model tier is available for a user tier.
 * This is the unified implementation used by both server and client.
 *
 * @param modelTier - The tier required by the model (undefined = no tier restriction)
 * @param userTier - Current user's subscription tier (null = not logged in, "free" = logged in no sub, "basic" = basic sub, "plus" = plus sub, "pro" = pro sub)
 * @returns true if the model is available, false otherwise
 */
function checkModelTierAvailability(
  modelTier: string | undefined,
  userTier: string | null
): boolean {
  // If model has no tier, make it available (fallback)
  if (!modelTier) {
    return true;
  }

  // Not logged in (null userTier): only free tier models
  if (userTier === null) {
    return modelTier === "free";
  }

  // Legacy/edge case: "free" tier in database (shouldn't happen for new users, but handle gracefully)
  if (userTier === "free") {
    return modelTier === "free";
  }

  // Basic tier: automatically awarded to all logged-in users - can access free and basic tier models
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
}

/**
 * Determines whether the given model can be accessed using the user's API provider keys.
 *
 * @param modelId - The model identifier (expected format like `"provider/modelName"`, e.g., `"openai/gpt-4"`)
 * @param userApiKeys - List of provider API keys the user possesses (values from `ApiProvider`)
 * @returns `true` if the user has an API key that grants access to the model, `false` otherwise.
 */
export function isModelAvailableViaApiKey(
  modelId: string,
  userApiKeys: ApiProvider[]
): boolean {
  const modelProvider = getProviderFromModelId(modelId);
  
  if (!modelProvider) return false;
  
  // OpenRouter key gives access to ALL models
  if (userApiKeys.includes("openrouter")) {
    return true;
  }
  
  // Provider-specific keys give access to their models
  if (modelProvider === "openai" && userApiKeys.includes("openai")) {
    return true;
  }
  
  if (modelProvider === "anthropic" && userApiKeys.includes("anthropic")) {
    return true;
  }
  
  if (modelProvider === "google" && userApiKeys.includes("google")) {
    return true;
  }
  
  return false;
}

/**
 * Determine whether a model is accessible to a user via subscription or the user's API keys and provide the reason for accessibility or lock.
 *
 * @param model - Object describing the model; `id` or `openrouterId` is used to evaluate API-key access and `subscriptionTier` is used to evaluate subscription access.
 * @param userTier - The user's subscription tier (e.g., `"free"`, `"basic"`, `"plus"`, `"pro"`), or `null` if the user is not logged in.
 * @param userApiKeys - List of API providers for which the user has supplied keys.
 * @returns An object describing availability:
 * - `isAvailable`: `true` if the model is accessible via subscription or API key, `false` otherwise.
 * - `isCoveredBySubscription`: `true` if access is granted by the user's subscription tier.
 * - `requiresOwnKey`: `true` if access requires the user's own API key (even when available).
 * - `reason`: `"subscription"` if subscription grants access, `"api_key"` if access is only via API key, or `"locked"` if not accessible.
 */
export function getModelAvailability(
  model: { 
    id?: string;
    subscriptionTier?: string;
    openrouterId?: string;
  },
  userTier: string | null = null,
  userApiKeys: ApiProvider[] = []
): ModelAvailability {
  const modelId = model.id || model.openrouterId || "";
  const modelTier = model.subscriptionTier;
  
  // Check subscription-based availability
  const isAvailableBySubscription = checkModelTierAvailability(modelTier, userTier);
  
  // Check API key-based availability
  const isAvailableByApiKey = modelId ? isModelAvailableViaApiKey(modelId, userApiKeys) : false;
  
  // Determine final availability
  const isAvailable = isAvailableBySubscription || isAvailableByApiKey;
  
  if (!isAvailable) {
    return {
      isAvailable: false,
      isCoveredBySubscription: false,
      requiresOwnKey: true,
      reason: "locked"
    };
  }
  
  if (isAvailableBySubscription) {
    return {
      isAvailable: true,
      isCoveredBySubscription: true,
      requiresOwnKey: false,
      reason: "subscription"
    };
  }
  
  // Available via API key (not covered by subscription)
  return {
    isAvailable: true,
    isCoveredBySubscription: false,
    requiresOwnKey: true,
    reason: "api_key"
  };
}

/**
 * Determines if a model is available for the current user based on subscription tier.
 * Client-safe version that accepts a model object.
 * Legacy function - use getModelAvailability for more details
 *
 * @param model - The model to check
 * @param userTier - Current user's subscription tier (null = not logged in, "free" = logged in no sub, "basic" = basic sub, "plus" = plus sub, "pro" = pro sub)
 * @returns true if the model is available, false otherwise
 */
export const isModelAvailable = (
  model: { subscriptionTier?: string },
  userTier: string | null = null
): boolean => {
  return checkModelTierAvailability(model.subscriptionTier, userTier);
};

/**
 * Client-safe version that accepts model tier as a string directly.
 * Used by ModelSelector for checking tier availability without full model object.
 * Legacy function - use getModelAvailability for more details
 *
 * @param modelTier - The tier required by the model
 * @param userTier - Current user's subscription tier (null = not logged in, "free" = logged in no sub, "basic" = basic sub, "plus" = plus sub, "pro" = pro sub)
 * @returns true if the model is available, false otherwise
 */
export const isModelAvailableByTier = (
  modelTier: string | undefined,
  userTier: string | null = "free"
): boolean => {
  return checkModelTierAvailability(modelTier, userTier);
};

export const TIER_ORDER = ["free", "basic", "plus", "pro"] as const;

export const getTierHierarchy = (tier: string): number => {
  const index = TIER_ORDER.indexOf(tier as any);
  return index === -1 ? 0 : index;
};

/**
 * Checks if subscription tiers feature is enabled via environment variable
 * Client-safe version - checks NEXT_PUBLIC_ env var
 */
export const isSubscriptionTiersEnabled = (): boolean => {
  if (typeof process !== "undefined" && process.env) {
    const value = process.env.NEXT_PUBLIC_ENABLE_SUBSCRIPTION_TIERS;
    return value === "true" || value === "1";
  }
  return false;
};