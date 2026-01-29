import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Record usage statistics
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
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
    const thisMonthStart = new Date(now);
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const thisMonthUsage = allUsage.filter((u: any) => u.timestamp >= thisMonthStart.getTime());

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
