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

/**
 * Get user's API keys
 * Note: This uses clerkUserId from the client instead of ctx.auth for API route compatibility
 */
export const getUserKeys = query({
  args: {
    clerkUserId: v.optional(v.string()), // Optional: when provided, bypasses ctx.auth
  },
  handler: async (ctx, args) => {
    let clerkUserId: string | null = null;
    
    // If clerkUserId is provided (from API route), use it directly
    if (args.clerkUserId) {
      clerkUserId = args.clerkUserId;
    } else {
      // Otherwise use ctx.auth (for client-side calls)
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return [];
      }
      clerkUserId = identity.subject;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
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
 * Note: This uses clerkUserId from the client instead of ctx.auth for compatibility
 */
export const upsertKey = mutation({
  args: {
    clerkUserId: v.string(), // Clerk user ID from authenticated client
    provider: v.union(
      v.literal("openrouter"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google")
    ),
    keyHash: v.string(), // Encrypted key
  },
  handler: async (ctx, args) => {
    // Find user by Clerk ID (passed from authenticated API route)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", args.clerkUserId))
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
/**
 * Delete API key
 * Note: This uses clerkUserId from the client instead of ctx.auth for compatibility
 */
export const deleteKey = mutation({
  args: {
    clerkUserId: v.string(), // Clerk user ID from authenticated client
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    // Find user by Clerk ID (passed from authenticated API route)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", args.clerkUserId))
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
 * Note: This uses clerkUserId from the client instead of ctx.auth for API route compatibility
 */
export const getKeyForProvider = query({
  args: {
    provider: v.union(
      v.literal("openrouter"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google")
    ),
    clerkUserId: v.optional(v.string()), // Optional: when provided, bypasses ctx.auth
  },
  handler: async (ctx, args) => {
    let clerkUserId: string | null = null;
    
    // If clerkUserId is provided (from API route), use it directly
    if (args.clerkUserId) {
      clerkUserId = args.clerkUserId;
    } else {
      // Otherwise use ctx.auth (for client-side calls)
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return null;
      }
      clerkUserId = identity.subject;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
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

/**
 * Get all active API key providers for the current user
 * Returns a list of providers that have active keys (without the actual keys)
 * Note: This uses clerkUserId from the client instead of ctx.auth for API route compatibility
 */
export const getActiveProviders = query({
  args: {
    clerkUserId: v.optional(v.string()), // Optional: when provided, bypasses ctx.auth
  },
  handler: async (ctx, args) => {
    let clerkUserId: string | null = null;
    
    // If clerkUserId is provided (from API route), use it directly
    if (args.clerkUserId) {
      clerkUserId = args.clerkUserId;
    } else {
      // Otherwise use ctx.auth (for client-side calls)
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return [];
      }
      clerkUserId = identity.subject;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!user) {
      return [];
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    // Return only active providers (without key hashes for security)
    return keys
      .filter(key => key.isActive)
      .map(key => ({
        provider: key.provider,
        useOwnKey: key.useOwnKey ?? false,
      }));
  },
});

/**
 * Get all API keys for key rotation (admin operation)
 * WARNING: This returns all keys with their hashes - use only for key rotation
 * This should be restricted to admin access in production
 */
export const getAllKeysForRotation = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Admin-only: return minimal, non-secret fields (do NOT return keyHash).
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

/**
 * Internal: fetch encrypted API keys for rotation workflows.
 * Not accessible from the client.
 */
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

/**
 * Update API key hash (for key rotation)
 * WARNING: This is a sensitive operation - should be restricted to admin access
 */
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

/**
 * Internal: update API key hash (rotation). Not accessible from the client.
 */
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
