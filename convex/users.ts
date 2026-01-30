import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get or create user from Clerk user ID
 */
export const getOrCreateUser = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      subscriptionTier: "free",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Get current user by Clerk user ID
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();
  },
});

/**
 * Get user by Clerk user ID (for server-side use)
 */
export const getUserByClerkUserId = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

/**
 * Update user subscription tier
 */
export const updateSubscriptionTier = mutation({
  args: {
    userId: v.id("users"),
    tier: v.union(v.literal("free"), v.literal("basic"), v.literal("plus"), v.literal("pro")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      subscriptionTier: args.tier,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get user by ID
 */
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Update user language preference
 */
export const updatePreferredLanguage = mutation({
  args: {
    language: v.string(),
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

    await ctx.db.patch(user._id, {
      preferredLanguage: args.language,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update user preferred name
 */
export const updatePreferredName = mutation({
  args: {
    name: v.string(),
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

    await ctx.db.patch(user._id, {
      preferredName: args.name.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update user custom guidelines
 */
export const updateCustomGuidelines = mutation({
  args: {
    guidelines: v.string(),
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

    await ctx.db.patch(user._id, {
      customGuidelines: args.guidelines.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Clear user custom guidelines (revert to default)
 */
export const clearCustomGuidelines = mutation({
  args: {},
  handler: async (ctx) => {
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

    await ctx.db.patch(user._id, {
      customGuidelines: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update user default structure hints
 */
export const updateDefaultStructureHints = mutation({
  args: {
    hints: v.string(),
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

    await ctx.db.patch(user._id, {
      defaultStructureHints: args.hints.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update Notion configuration
 */
export const updateNotionConfig = mutation({
  args: {
    token: v.string(),
    databaseId: v.optional(v.string()),
    exportMethod: v.optional(v.union(v.literal("database"), v.literal("page"))),
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

    // Encrypt the token before storing (simple base64 encoding as placeholder)
    // Note: This is a placeholder implementation. In production, use proper encryption.
    // Using web-standard APIs (TextEncoder + btoa) instead of Node.js Buffer
    const encoder = new TextEncoder();
    const bytes = encoder.encode(args.token);
    const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    const encryptedToken = btoa(binaryString);

    await ctx.db.patch(user._id, {
      notionToken: encryptedToken,
      notionDatabaseId: args.databaseId || undefined,
      notionExportMethod: args.exportMethod || undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Clear Notion configuration
 */
export const clearNotionConfig = mutation({
  args: {},
  handler: async (ctx) => {
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

    await ctx.db.patch(user._id, {
      notionToken: undefined,
      notionDatabaseId: undefined,
      notionExportMethod: undefined,
      updatedAt: Date.now(),
    });
  },
});