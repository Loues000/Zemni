import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Update subscription tier by Stripe customer ID
 * Called from webhook handler
 */
export const updateSubscriptionByCustomerId = mutation({
  args: {
    stripeCustomerId: v.string(),
    tier: v.union(v.literal("free"), v.literal("basic"), v.literal("plus"), v.literal("pro")),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find user by Stripe customer ID
    const user = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("stripeCustomerId"), args.stripeCustomerId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      subscriptionTier: args.tier,
      stripeSubscriptionId: args.stripeSubscriptionId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update subscription tier by Clerk user ID
 */
export const updateSubscriptionByClerkUserId = mutation({
  args: {
    clerkUserId: v.string(),
    tier: v.union(v.literal("free"), v.literal("basic"), v.literal("plus"), v.literal("pro")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      subscriptionTier: args.tier,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      updatedAt: Date.now(),
    });
  },
});
