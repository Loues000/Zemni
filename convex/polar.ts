import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Update subscription tier by Polar customer ID
 * Called from webhook handler
 */
export const updateSubscriptionByCustomerId = mutation({
  args: {
    polarCustomerId: v.string(),
    tier: v.union(v.literal("free"), v.literal("basic"), v.literal("plus"), v.literal("pro")),
    polarSubscriptionId: v.optional(v.string()),
    subscriptionStartDate: v.optional(v.number()), // Timestamp when subscription started
  },
  handler: async (ctx, args) => {
    // Find user by Polar customer ID
    const user = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("polarCustomerId"), args.polarCustomerId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const updateData: any = {
      subscriptionTier: args.tier,
      polarSubscriptionId: args.polarSubscriptionId,
      updatedAt: Date.now(),
    };

    // Only update subscriptionStartDate if:
    // 1. It's provided (new subscription)
    // 2. User doesn't have one yet (first subscription)
    // 3. User is upgrading to a paid tier (plus/pro)
    if (args.subscriptionStartDate !== undefined) {
      const isPaidTier = args.tier === "plus" || args.tier === "pro";
      const hasNoStartDate = !user.subscriptionStartDate;
      const isUpgrading = hasNoStartDate || (isPaidTier && user.subscriptionTier !== args.tier);

      if (isUpgrading) {
        updateData.subscriptionStartDate = args.subscriptionStartDate;
      }
    }

    await ctx.db.patch(user._id, updateData);
  },
});

/**
 * Update subscription tier by Clerk user ID
 */
export const updateSubscriptionByClerkUserId = mutation({
  args: {
    clerkUserId: v.string(),
    tier: v.union(v.literal("free"), v.literal("basic"), v.literal("plus"), v.literal("pro")),
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),
    subscriptionStartDate: v.optional(v.number()), // Timestamp when subscription started
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const updateData: any = {
      subscriptionTier: args.tier,
      polarCustomerId: args.polarCustomerId,
      polarSubscriptionId: args.polarSubscriptionId,
      updatedAt: Date.now(),
    };

    // Only update subscriptionStartDate if:
    // 1. It's provided (new subscription)
    // 2. User doesn't have one yet (first subscription)
    // 3. User is upgrading to a paid tier (plus/pro)
    if (args.subscriptionStartDate !== undefined) {
      const isPaidTier = args.tier === "plus" || args.tier === "pro";
      const hasNoStartDate = !user.subscriptionStartDate;
      const isUpgrading = hasNoStartDate || (isPaidTier && user.subscriptionTier !== args.tier);

      if (isUpgrading) {
        updateData.subscriptionStartDate = args.subscriptionStartDate;
      }
    }

    await ctx.db.patch(user._id, updateData);
  },
});
