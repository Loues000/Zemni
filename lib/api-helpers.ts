import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { decryptKey } from "./encryption";
import { isModelAvailable } from "./models";

// Create unauthenticated Convex client (auth happens via clerkUserId param)
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export type ApiProvider = "openrouter" | "openai" | "anthropic" | "google";

export interface ApiKeyInfo {
  provider: ApiProvider;
  useOwnKey: boolean;
  key?: string;
}

export interface UserContext {
  userId: string;
  userTier: "free" | "basic" | "plus" | "pro";
  useOwnKey: boolean;
  apiKey?: string;
  apiKeys: ApiKeyInfo[];
  preferredLanguage?: string;
  customGuidelines?: string;
}

/**
 * Get user context for API routes
 * Returns user authentication, tier, and API key preferences
 */
export async function getUserContext(): Promise<UserContext | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Get user from Convex using clerkUserId
  const user = await convex.query(api.users.getUserByClerkUserId, {
    clerkUserId: userId,
  });

  if (!user) {
    return null;
  }

  // Get all active API keys for the user
  const activeProviders = await convex.query(api.apiKeys.getActiveProviders, { 
    clerkUserId: userId 
  });
  
  const apiKeys: ApiKeyInfo[] = [];
  let apiKey: string | undefined;

  // Load all API keys
  for (const providerInfo of activeProviders) {
    const userKey = await convex.query(api.apiKeys.getKeyForProvider, {
      provider: providerInfo.provider,
      clerkUserId: userId,
    });

    if (userKey && userKey.keyHash) {
      const decryptedKey = decryptKey(userKey.keyHash);
      apiKeys.push({
        provider: providerInfo.provider,
        useOwnKey: providerInfo.useOwnKey,
        key: decryptedKey,
      });

      // Keep backward compatibility - use openrouter as primary key if available
      if (providerInfo.provider === "openrouter" && providerInfo.useOwnKey) {
        apiKey = decryptedKey;
      }
    }
  }

  // Check if user wants to use own keys (any provider)
  const useOwnKeyPreference = apiKeys.some(k => k.useOwnKey);

  return {
    userId: user._id,
    userTier: user.subscriptionTier,
    useOwnKey: useOwnKeyPreference,
    apiKey,
    apiKeys,
    preferredLanguage: user.preferredLanguage,
    customGuidelines: user.customGuidelines,
  };
}

/**
 * Get the appropriate API key for a specific model
 * Returns the key and provider info for making the API call
 * 
 * Logic:
 * - If model is available via subscription AND useOwnKey is not enabled: return null (use system key)
 * - If model is NOT available via subscription OR useOwnKey is enabled: use direct provider key if available
 * - Fallback to OpenRouter key if no provider-specific key exists
 */
export function getApiKeyForModel(
  modelId: string,
  userContext: UserContext | null,
  model: { subscriptionTier?: string } | null = null
): { key: string; provider: ApiProvider; isOwnKey: boolean } | null {
  if (!userContext?.apiKeys?.length) {
    return null;
  }

  const modelProvider = getProviderFromModelId(modelId);
  
  // Check if model is available via subscription
  const isAvailableBySubscription = model 
    ? isModelAvailable(model, userContext.userTier)
    : false;
  
  // If model is available via subscription AND user doesn't want to use own keys,
  // return null to use system OpenRouter key
  if (isAvailableBySubscription && !userContext.useOwnKey) {
    return null;
  }

  // Case 3: Model is NOT available via subscription AND user doesn't want to use own keys
  // → Block generation (user must enable useOwnKey or upgrade tier)
  if (!isAvailableBySubscription && !userContext.useOwnKey) {
    return null;
  }

  // Model is NOT available via subscription OR user wants to use own keys
  // Try to find provider-specific key first (direct API access)
  if (modelProvider) {
    const providerKey = userContext.apiKeys.find(k => 
      k.provider === modelProvider && 
      k.key
    );
    if (providerKey) {
      return { key: providerKey.key!, provider: modelProvider, isOwnKey: providerKey.useOwnKey };
    }
  }

  // Fallback to OpenRouter key if no provider-specific key exists
  const openRouterKey = userContext.apiKeys.find(k => 
    k.provider === "openrouter" && 
    k.key
  );
  if (openRouterKey) {
    return { key: openRouterKey.key!, provider: "openrouter", isOwnKey: openRouterKey.useOwnKey };
  }

  return null;
}

/**
 * Extract provider from model ID
 */
function getProviderFromModelId(modelId: string): ApiProvider | null {
  const parts = modelId.split("/");
  if (parts.length < 2) return null;
  
  const provider = parts[0].toLowerCase();
  
  if (provider === "openai") return "openai";
  if (provider === "anthropic") return "anthropic";
  if (provider === "google") return "google";
  if (provider === "openrouter" || provider === "x-ai" || provider === "mistral" || 
      provider === "meta" || provider === "nvidia" || provider === "microsoft" ||
      provider === "amazon" || provider === "cohere") {
    return "openrouter";
  }
  
  return null;
}

/**
 * Check if a model is available for the user
 * Considers both subscription tier AND API keys
 */
export function checkModelAvailability(
  model: { 
    id?: string;
    openrouterId?: string;
    subscriptionTier?: string 
  },
  userContext: UserContext | null
): boolean {
  // First check subscription-based availability
  const availableBySubscription = isModelAvailable(model, userContext?.userTier || "free");
  
  if (availableBySubscription) {
    return true;
  }
  
  // If not available by subscription, check if user has API key for this model
  // getApiKeyForModel will return null if useOwnKey=false, so availability is correctly blocked
  if (userContext && (model.id || model.openrouterId)) {
    const modelId = model.id || model.openrouterId!;
    const apiKeyInfo = getApiKeyForModel(modelId, userContext, model);
    return apiKeyInfo !== null;
  }
  
  return false;
}

/**
 * Get API key to use (user's key if preferred, otherwise system key)
 */
export function getApiKeyToUse(userContext: UserContext | null): string | undefined {
  if (userContext?.useOwnKey && userContext.apiKey) {
    return userContext.apiKey;
  }
  return process.env.OPENROUTER_API_KEY;
}
