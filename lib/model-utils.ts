/**
 * Determines if a model is available for the current user based on subscription tier.
 * Client-safe implementation that accepts model tier as a string.
 * 
 * This is a wrapper around the unified logic in lib/models.ts for client-side usage.
 * 
 * @param modelTier - The tier required by the model
 * @param userTier - Current user's subscription tier (null = not logged in, "free" = logged in no sub, "basic" = basic sub, "plus" = plus sub, "pro" = pro sub)
 * @returns true if the model is available, false otherwise
 */
import { isModelAvailable as checkModelAvailability } from "./models";

export const isModelAvailable = (
    modelTier: string | undefined,
    userTier: string | null = "free"
): boolean => {
    // Use the unified implementation from lib/models.ts
    return checkModelAvailability({ subscriptionTier: modelTier }, userTier);
};

export const TIER_ORDER = ["free", "basic", "plus", "pro"] as const;

export const getTierHierarchy = (tier: string): number => {
    const index = TIER_ORDER.indexOf(tier as any);
    return index === -1 ? 0 : index;
};
