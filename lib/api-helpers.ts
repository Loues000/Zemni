import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { decryptKey } from "./encryption";
import { isModelAvailable } from "./models";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface UserContext {
  userId: string;
  userTier: "free" | "basic" | "plus" | "pro";
  useOwnKey: boolean;
  apiKey?: string;
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

  // Get user from Convex
  // Note: In production, use proper authenticated Convex queries
  const user = await convex.query(api.users.getCurrentUser, {});

  if (!user) {
    return null;
  }

  // Check if user wants to use own keys
  const useOwnKeyPreference = await convex.query(api.apiKeys.getUseOwnKeyPreference, {});
  let apiKey: string | undefined;

  if (useOwnKeyPreference) {
    // Get user's OpenRouter key
    const userKey = await convex.query(api.apiKeys.getKeyForProvider, {
      provider: "openrouter",
    });

    if (userKey && userKey.keyHash) {
      apiKey = decryptKey(userKey.keyHash);
    }
  }

  return {
    userId: user._id,
    userTier: user.subscriptionTier,
    useOwnKey: useOwnKeyPreference ?? false,
    apiKey,
  };
}

/**
 * Check if a model is available for the user
 */
export function checkModelAvailability(
  model: { subscriptionTier?: string },
  userTier: "free" | "basic" | "plus" | "pro"
): boolean {
  return isModelAvailable(model, userTier);
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
