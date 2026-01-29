import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get user's API keys
 */
export const getUserKeys = query({
  args: {},
  handler: async (ctx) => {
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

    return await ctx.db
      .query("apiKeys")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

/**
 * Get user's preference for using own keys
 */
export const getUseOwnKeyPreference = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return false;
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .first();

    return keys?.useOwnKey ?? false;
  },
});

/**
 * Set user's preference for using own keys
 */
export const setUseOwnKeyPreference = mutation({
  args: {
    useOwnKey: v.boolean(),
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

    // Update all keys with the preference
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    for (const key of keys) {
      await ctx.db.patch(key._id, {
        useOwnKey: args.useOwnKey,
      });
    }

    // If no keys exist, create a placeholder entry
    if (keys.length === 0) {
      await ctx.db.insert("apiKeys", {
        userId: user._id,
        provider: "openrouter",
        keyHash: "",
        isActive: false,
        useOwnKey: args.useOwnKey,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Add or update API key
 */
export const upsertKey = mutation({
  args: {
    provider: v.union(
      v.literal("openrouter"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google")
    ),
    keyHash: v.string(), // Encrypted key
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

    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", user._id).eq("provider", args.provider)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        keyHash: args.keyHash,
        isActive: true,
        lastUsed: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("apiKeys", {
        userId: user._id,
        provider: args.provider,
        keyHash: args.keyHash,
        isActive: true,
        useOwnKey: false,
        createdAt: now,
        lastUsed: now,
      });
    }
  },
});

/**
 * Delete API key
 */
export const deleteKey = mutation({
  args: {
    keyId: v.id("apiKeys"),
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

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== user._id) {
      throw new Error("API key not found");
    }

    await ctx.db.delete(args.keyId);
  },
});

/**
 * Get API key for a specific provider (server-side only, returns encrypted hash)
 */
export const getKeyForProvider = query({
  args: {
    provider: v.union(
      v.literal("openrouter"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", user._id).eq("provider", args.provider)
      )
      .first();

    if (!key || !key.isActive) {
      return null;
    }

    return {
      keyHash: key.keyHash,
      useOwnKey: key.useOwnKey ?? false,
    };
  },
});
