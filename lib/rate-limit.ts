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
 * Build the in-memory store key for a user's rate limit entry.
 *
 * @returns The storage key in the format `"<type>:<userId>"`.
 */
function getRateLimitKey(userId: string, type: RateLimitType): string {
  return `${type}:${userId}`;
}

/**
 * Return the maximum allowed requests for the specified rate limit type.
 *
 * @param type - The rate limit category (`"key_management"` or `"generation"`)
 * @returns The maximum number of requests for `type` (`5` for `"key_management"`, `30` for `"generation"`)
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
 * Determine whether a user's request for a given rate limit type is permitted under the current window.
 *
 * @param userId - ID of the user to check
 * @param type - Rate limit category to evaluate; defaults to `"key_management"` for backward compatibility
 * @returns An object with `allowed` set to `true` if the request is permitted, `false` otherwise. When `allowed` is `false`, `retryAfter` contains the number of seconds until the current window resets.
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
 * Clear stored rate limit state for a user.
 *
 * If `type` is provided, clears only that rate limit; otherwise clears both
 * "key_management" and "generation" entries.
 *
 * @param userId - The user identifier whose rate limit state will be cleared
 * @param type - Optional rate limit type to clear; when omitted, clears all types
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