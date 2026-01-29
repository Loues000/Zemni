/**
 * Determines if a model is available for the current user based on subscription tier.
 * Client-safe implementation.
 * 
 * @param modelTier - The tier required by the model
 * @param userTier - Current user's subscription tier
 * @returns true if the model is available, false otherwise
 */
export const isModelAvailable = (
    modelTier: string | undefined,
    userTier: string | null = "free"
): boolean => {
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

export const TIER_ORDER = ["free", "basic", "plus", "pro"] as const;

export const getTierHierarchy = (tier: string): number => {
    const index = TIER_ORDER.indexOf(tier as any);
    return index === -1 ? 0 : index;
};
