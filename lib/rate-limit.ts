/**
 * In-memory rate limiting for API key operations
 * Limits: 5 operations per user per hour
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store: userId -> RateLimitEntry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval: remove old entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5;

// Start cleanup interval (only in Node.js environment)
if (typeof global !== "undefined" && typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(userId);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Check if user has exceeded rate limit
 * Returns { allowed: boolean, retryAfter?: number }
 */
export function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // No entry or expired window - allow and create new entry
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  // Check if limit exceeded
  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000); // seconds
    return { allowed: false, retryAfter };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

/**
 * Reset rate limit for a user (useful for testing)
 */
export function resetRateLimit(userId: string): void {
  rateLimitStore.delete(userId);
}
