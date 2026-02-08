import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Rate limit constants
 */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_KEY_MANAGEMENT = 5; // 5 operations per hour for key management
const MAX_REQUESTS_GENERATION = 30; // 30 operations per hour for generation endpoints

/**
 * Get the maximum requests allowed for a rate limit type
 */
function getMaxRequests(type: "key_management" | "generation"): number {
  return type === "key_management" ? MAX_REQUESTS_KEY_MANAGEMENT : MAX_REQUESTS_GENERATION;
}

/**
 * Check if user has exceeded rate limit and increment count atomically
 * Returns { allowed: boolean, retryAfter?: number }
 * 
 * This mutation is atomic, ensuring rate limits are enforced correctly
 * even with concurrent requests.
 */
export const checkRateLimit = mutation({
  args: {
    clerkUserId: v.string(), // Clerk user ID
    type: v.union(v.literal("key_management"), v.literal("generation")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const maxRequests = getMaxRequests(args.type);

    // Find existing rate limit entry
    let existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_clerk_user_type", (q) =>
        q.eq("clerkUserId", args.clerkUserId).eq("type", args.type)
      )
      .first();

    if (!existing) {
      const legacyEntries = await ctx.db.query("rateLimits").collect();
      const legacyMatch = legacyEntries.find((entry) => {
        const legacyUserId = (entry as { userId?: string }).userId;
        return legacyUserId === args.clerkUserId && entry.type === args.type;
      });

      if (legacyMatch) {
        await ctx.db.patch(legacyMatch._id, {
          clerkUserId: args.clerkUserId,
          userId: undefined,
        });
        existing = legacyMatch;
      }
    }

    // No entry - create new entry
    if (!existing) {
      await ctx.db.insert("rateLimits", {
        clerkUserId: args.clerkUserId,
        type: args.type,
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW_MS,
      });
      return { allowed: true };
    }

    // Expired window - reset existing entry instead of inserting a duplicate
    if (existing.resetTime < now) {
      await ctx.db.patch(existing._id, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW_MS,
      });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (existing.count >= maxRequests) {
      const retryAfter = Math.ceil((existing.resetTime - now) / 1000); // seconds
      return { allowed: false, retryAfter };
    }

    // Increment count atomically
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
    });

    return { allowed: true };
  },
});

/**
 * Reset rate limit for a user (useful for testing)
 */
export const resetRateLimit = mutation({
  args: {
    clerkUserId: v.string(), // Clerk user ID
    type: v.optional(v.union(v.literal("key_management"), v.literal("generation"))),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      // Reset specific type
      const type = args.type; // Type narrowing for TypeScript
      const entry = await ctx.db
        .query("rateLimits")
        .withIndex("by_clerk_user_type", (q) =>
          q.eq("clerkUserId", args.clerkUserId).eq("type", type)
        )
        .first();
      
      if (entry) {
        await ctx.db.delete(entry._id);
      }

      const legacyEntries = await ctx.db.query("rateLimits").collect();
      const legacyMatch = legacyEntries.find((item) => {
        const legacyUserId = (item as { userId?: string }).userId;
        return legacyUserId === args.clerkUserId && item.type === type;
      });
      if (legacyMatch) {
        await ctx.db.delete(legacyMatch._id);
      }
    } else {
      // Reset all types for user - need to query all entries and filter
      // Note: Convex doesn't support partial index queries, so we query all and filter
      const allEntries = await ctx.db
        .query("rateLimits")
        .collect();
      
      const userEntries = allEntries.filter((entry) => {
        const legacyUserId = (entry as { userId?: string }).userId;
        return entry.clerkUserId === args.clerkUserId || legacyUserId === args.clerkUserId;
      });
      
      for (const entry of userEntries) {
        await ctx.db.delete(entry._id);
      }
    }
  },
});
