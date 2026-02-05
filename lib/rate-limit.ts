/**
 * In-memory rate limiting for API operations
 * Supports different rate limit types with separate limits
 */

export type RateLimitType = "key_management" | "generation";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store: type:userId -> RateLimitEntry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval: remove old entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Rate limits per type
const MAX_REQUESTS_KEY_MANAGEMENT = 5; // 5 operations per hour for key management
const MAX_REQUESTS_GENERATION = 30; // 30 operations per hour for generation endpoints

/**
 * Get the storage key for a rate limit entry
 */
function getRateLimitKey(userId: string, type: RateLimitType): string {
  return `${type}:${userId}`;
}

/**
 * Get the maximum requests allowed for a rate limit type
 */
function getMaxRequests(type: RateLimitType): number {
  return type === "key_management" ? MAX_REQUESTS_KEY_MANAGEMENT : MAX_REQUESTS_GENERATION;
}

// Start cleanup interval (only in Node.js environment)
if (typeof global !== "undefined" && typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Check if user has exceeded rate limit
 * Returns { allowed: boolean, retryAfter?: number }
 * 
 * @param userId - User ID to check rate limit for
 * @param type - Type of rate limit (defaults to "key_management" for backward compatibility)
 */
export function checkRateLimit(
  userId: string,
  type: RateLimitType = "key_management"
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = getRateLimitKey(userId, type);
  const entry = rateLimitStore.get(key);
  const maxRequests = getMaxRequests(type);

  // No entry or expired window - allow and create new entry
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000); // seconds
    return { allowed: false, retryAfter };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

/**
 * Reset rate limit for a user (useful for testing)
 * 
 * @param userId - User ID to reset rate limit for
 * @param type - Type of rate limit (optional, resets all types if not specified)
 */
export function resetRateLimit(userId: string, type?: RateLimitType): void {
  if (type) {
    const key = getRateLimitKey(userId, type);
    rateLimitStore.delete(key);
  } else {
    // Reset all types for backward compatibility
    rateLimitStore.delete(getRateLimitKey(userId, "key_management"));
    rateLimitStore.delete(getRateLimitKey(userId, "generation"));
  }
}
