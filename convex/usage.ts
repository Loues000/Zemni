import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Usage limits per subscription tier
 * Must match lib/usage-limits.ts
 */
const USAGE_LIMITS: Record<string, number> = {
  free: 5,
  basic: 20,
  plus: 100,
  pro: 200,
};

function getUsageLimit(tier: string | null | undefined): number {
  if (!tier || !(tier in USAGE_LIMITS)) {
    return USAGE_LIMITS.free;
  }
  return USAGE_LIMITS[tier as keyof typeof USAGE_LIMITS];
}

/**
 * Record usage statistics
 * Can be called from client (authenticated) or server (with clerkUserId)
 */
export const recordUsage = mutation({
  args: {
    documentId: v.optional(v.id("documents")),
    source: v.union(
      v.literal("summarize"),
      v.literal("refine"),
      v.literal("flashcards"),
      v.literal("quiz"),
      v.literal("section-summary")
    ),
    tokensIn: v.number(),
    tokensOut: v.number(),
    cost: v.number(),
    modelId: v.string(),
    clerkUserId: v.optional(v.string()), // For server-side calls
  },
  handler: async (ctx, args) => {
    let user;

    // If clerkUserId is provided (server-side call), use it directly
    if (args.clerkUserId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", args.clerkUserId))
        .first();
    } else {
      // Otherwise, use authenticated identity (client-side call)
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        // Silently skip if not authenticated (e.g., unauthenticated usage)
        return;
      }

      user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
        .first();
    }

    if (!user) {
      // Silently skip if user not found (they may not have completed onboarding)
      return;
    }

    await ctx.db.insert("usage", {
      userId: user._id,
      documentId: args.documentId,
      source: args.source,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      cost: args.cost,
      modelId: args.modelId,
      timestamp: Date.now(),
    });
  },
});

/**
 * Get usage statistics for current user
 */
export const getUsageStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        totalDocuments: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCost: 0,
        thisMonthDocuments: 0,
        thisMonthTokensIn: 0,
        thisMonthTokensOut: 0,
        thisMonthCost: 0,
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return {
        totalDocuments: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCost: 0,
        thisMonthDocuments: 0,
        thisMonthTokensIn: 0,
        thisMonthTokensOut: 0,
        thisMonthCost: 0,
      };
    }

    const allUsage = await ctx.db
      .query("usage")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();
    // Use billing cycle start instead of calendar month start
    const thisMonthStart = getBillingCycleStart(user, now);

    const thisMonthUsage = allUsage.filter((u: any) => u.timestamp >= thisMonthStart);

    const totalTokensIn = allUsage.reduce((sum: number, u: any) => sum + u.tokensIn, 0);
    const totalTokensOut = allUsage.reduce((sum: number, u: any) => sum + u.tokensOut, 0);
    const totalCost = allUsage.reduce((sum: number, u: any) => sum + u.cost, 0);

    const thisMonthTokensIn = thisMonthUsage.reduce((sum: number, u: any) => sum + u.tokensIn, 0);
    const thisMonthTokensOut = thisMonthUsage.reduce((sum: number, u: any) => sum + u.tokensOut, 0);
    const thisMonthCost = thisMonthUsage.reduce((sum: number, u: any) => sum + u.cost, 0);

    // Count unique documents
    const documentIds = new Set(
      allUsage.filter((u: any) => u.documentId).map((u: any) => u.documentId!)
    );
    const thisMonthDocumentIds = new Set(
      thisMonthUsage.filter((u: any) => u.documentId).map((u: any) => u.documentId!)
    );

    return {
      totalDocuments: documentIds.size,
      totalTokensIn,
      totalTokensOut,
      totalCost,
      thisMonthDocuments: thisMonthDocumentIds.size,
      thisMonthTokensIn,
      thisMonthTokensOut,
      thisMonthCost,
    };
  },
});

/**
 * Calculate billing cycle start date based on account/subscription creation
 * Returns the start of the current billing cycle month
 */
function getBillingCycleStart(user: any, now: number): number {
  // Use subscription start date for paid users, otherwise use account creation date
  const startDate = user.subscriptionStartDate || user.createdAt;
  const start = new Date(startDate);

  // Get the day of month from the start date (e.g., 15th)
  const dayOfMonth = start.getDate();

  // Calculate current billing cycle start
  const nowDate = new Date(now);
  let currentCycle = new Date(nowDate.getFullYear(), nowDate.getMonth(), dayOfMonth);
  currentCycle.setHours(0, 0, 0, 0);

  // Handle edge case: if day doesn't exist in current month (e.g., Jan 31 -> Feb 31)
  // JavaScript Date will auto-adjust, so check if month changed
  if (currentCycle.getMonth() !== nowDate.getMonth()) {
    // Day doesn't exist, use last day of previous month
    currentCycle = new Date(nowDate.getFullYear(), nowDate.getMonth(), 0);
    currentCycle.setHours(0, 0, 0, 0);
  }

  // If we haven't reached the day of month this month, use last month's cycle start
  if (currentCycle.getTime() > now) {
    const lastMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, dayOfMonth);
    lastMonth.setHours(0, 0, 0, 0);

    // Handle edge case for last month too
    if (lastMonth.getMonth() !== (nowDate.getMonth() - 1 + 12) % 12) {
      // Day doesn't exist, use last day of that month
      lastMonth.setMonth(nowDate.getMonth());
      lastMonth.setDate(0); // Day 0 = last day of previous month
      lastMonth.setHours(0, 0, 0, 0);
    }

    return lastMonth.getTime();
  }

  return currentCycle.getTime();
}

/**
 * Get monthly generation count for summaries, flashcards, and quizzes
 * Returns current count, limit, and tier for usage limit enforcement
 */
export const getMonthlyGenerationCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        count: 0,
        limit: getUsageLimit("free"),
        tier: "free" as const,
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return {
        count: 0,
        limit: getUsageLimit("free"),
        tier: "free" as const,
      };
    }

    const tier = user.subscriptionTier || "free";
    const limit = getUsageLimit(tier);

    // Get all usage entries for this user
    const allUsage = await ctx.db
      .query("usage")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    // Calculate current billing cycle start based on account/subscription creation date
    const now = Date.now();
    const billingCycleStart = getBillingCycleStart(user, now);

    // Filter to current billing cycle and only count summarize, section-summary, flashcards, quiz
    const thisCycleGenerations = allUsage.filter(
      (u: any) =>
        u.timestamp >= billingCycleStart &&
        (u.source === "summarize" || u.source === "section-summary" || u.source === "flashcards" || u.source === "quiz")
    );

    return {
      count: thisCycleGenerations.length,
      limit,
      tier: tier as "free" | "basic" | "plus" | "pro",
    };
  },
});

/**
 * Get usage by model
 */
export const getUsageByModel = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return [];
    }

    const allUsage = await ctx.db
      .query("usage")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    const modelStats = new Map<
      string,
      { modelId: string; count: number; totalTokens: number; totalCost: number }
    >();

    for (const usage of allUsage) {
      const existing = modelStats.get(usage.modelId) || {
        modelId: usage.modelId,
        count: 0,
        totalTokens: 0,
        totalCost: 0,
      };

      existing.count += 1;
      existing.totalTokens += usage.tokensIn + usage.tokensOut;
      existing.totalCost += usage.cost;

      modelStats.set(usage.modelId, existing);
    }

    const result = Array.from(modelStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, args.limit ?? 10);

    return result;
  },
});
