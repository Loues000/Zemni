import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

function parseAdminAllowlist(): string[] {
  return (process.env.ADMIN_CLERK_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function requireAdmin(ctx: any): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const adminList = parseAdminAllowlist();
  if (!adminList.includes(identity.subject)) {
    throw new Error("Unauthorized");
  }
}

export const getUserKeys = query({
  args: {},
  handler: async (ctx, args) => {
    void args;

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

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    return keys.map((key) => ({
      _id: key._id,
      provider: key.provider,
      isActive: key.isActive,
      useOwnKey: key.useOwnKey ?? false,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
    }));
  },
});

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

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    for (const key of keys) {
      await ctx.db.patch(key._id, {
        useOwnKey: args.useOwnKey,
      });
    }

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

export const upsertKey = mutation({
  args: {
    provider: v.union(
      v.literal("openrouter"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google")
    ),
    keyHash: v.string(),
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

export const getActiveProviders = query({
  args: {},
  handler: async (ctx, args) => {
    void args;

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

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    return keys
      .filter(key => key.isActive)
      .map(key => ({
        provider: key.provider,
        useOwnKey: key.useOwnKey ?? false,
      }));
  },
});

export const getAllKeysForRotation = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allKeys = await ctx.db.query("apiKeys").collect();
    
    return allKeys.map(key => ({
      _id: key._id,
      userId: key.userId,
      provider: key.provider,
      isActive: key.isActive,
      useOwnKey: key.useOwnKey ?? false,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
    }));
  },
});

export const getAllKeysForRotationInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allKeys = await ctx.db.query("apiKeys").collect();
    return allKeys.map((key) => ({
      _id: key._id,
      userId: key.userId,
      provider: key.provider,
      keyHash: key.keyHash,
    }));
  },
});

export const updateKeyHash = mutation({
  args: {
    keyId: v.id("apiKeys"),
    newKeyHash: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const key = await ctx.db.get(args.keyId);
    if (!key) {
      throw new Error("API key not found");
    }

    await ctx.db.patch(args.keyId, {
      keyHash: args.newKeyHash,
    });

    return { success: true };
  },
});

export const updateKeyHashInternal = internalMutation({
  args: {
    keyId: v.id("apiKeys"),
    newKeyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) {
      throw new Error("API key not found");
    }

    await ctx.db.patch(args.keyId, {
      keyHash: args.newKeyHash,
    });

    return { success: true };
  },
});
