/**
 * Usage limits per subscription tier
 * Limits apply to summaries, flashcards, and quizzes combined
 */
export const USAGE_LIMITS: Record<string, number> = {
  free: 20,
  basic: 20,
  plus: 100,
  pro: 200,
} as const;

/**
 * Get the monthly generation limit for a subscription tier
 * @param tier - Subscription tier (free, basic, plus, pro)
 * @returns Monthly limit for the tier, defaults to free tier limit if tier is invalid
 */
export function getUsageLimit(tier: string | null | undefined): number {
  if (!tier || !(tier in USAGE_LIMITS)) {
    return USAGE_LIMITS.free;
  }
  return USAGE_LIMITS[tier as keyof typeof USAGE_LIMITS];
}

/**
 * Get the monthly generation limit for a subscription tier and content source.
 *
 * Currently all sources share the same per-tier limit; this function exists to allow
 * future per-source differentiation.
 *
 * @param tier - Subscription tier identifier (e.g., "free", "plus", "pro")
 * @param source - Content generation source ("summarize", "flashcards", or "quiz")
 * @returns The monthly limit for the specified tier and source
 */
export function getUsageLimitForSource(
  tier: string | null | undefined,
  source: "summarize" | "flashcards" | "quiz"
): number {
  // All sources currently share the same limit
  return getUsageLimit(tier);
}