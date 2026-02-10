import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const CONTACT_RETENTION_DAYS = 90;
const CONTACT_RETENTION_MS = CONTACT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

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
      if (!existing.subscriptionTier) {
        await ctx.db.patch(existing._id, {
          subscriptionTier: "free",
          updatedAt: Date.now(),
        });
      }
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

export const ensureCorrectTier = mutation({
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

    if (!user.subscriptionTier) {
      await ctx.db.patch(user._id, {
        subscriptionTier: "free",
        updatedAt: Date.now(),
      });
      console.log(`[ensureCorrectTier] Fixed tier for user ${user._id}: "${user.subscriptionTier || "undefined"}" -> "free"`);
      return { fixed: true, oldTier: user.subscriptionTier || "undefined", newTier: "free" };
    }

    return { fixed: false, tier: user.subscriptionTier };
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
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

    if (!user.subscriptionTier) {
      return {
        ...user,
        subscriptionTier: "free" as const,
      };
    }

    return user;
  },
});

export const getHistoryFolders = query({
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

    return user.historyFolders ?? [];
  },
});

export const addHistoryFolder = mutation({
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

    const normalized = args.name.trim();
    if (!normalized) {
      return { folders: user.historyFolders ?? [] };
    }

    const nextFolders = Array.from(new Set([...(user.historyFolders ?? []), normalized]));

    if (nextFolders.length === (user.historyFolders ?? []).length) {
      return { folders: nextFolders };
    }

    await ctx.db.patch(user._id, {
      historyFolders: nextFolders,
      updatedAt: Date.now(),
    });

    return { folders: nextFolders };
  },
});

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

export const storeContactSubmission = mutation({
  args: {
    subject: v.string(),
    message: v.string(),
    submissionId: v.string(),
    userAgent: v.optional(v.string()),
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

    const userEmail = user?.email || "anonymous@user";
    const userName = user?.preferredName || userEmail.split("@")[0] || "Anonymous User";
    const subject = args.subject.trim();
    const message = args.message.trim();
    const now = Date.now();

    await ctx.db.insert("contactSubmissions", {
      clerkUserId: identity.subject,
      userId: user?._id,
      userEmail,
      userName,
      subject,
      message,
      subjectLength: subject.length,
      messageLength: message.length,
      submissionId: args.submissionId,
      userAgent: args.userAgent || undefined,
      createdAt: now,
      retentionUntil: now + CONTACT_RETENTION_MS,
    });

    return { submissionId: args.submissionId };
  },
});

export const updateSubscriptionTier = mutation({
  args: {
    userId: v.id("users"),
    tier: v.union(v.literal("free"), v.literal("basic"), v.literal("plus"), v.literal("pro")),
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      subscriptionTier: args.tier,
      polarCustomerId: args.polarCustomerId,
      polarSubscriptionId: args.polarSubscriptionId,
      updatedAt: Date.now(),
    });
  },
});

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

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

export const updateNotionConfig = mutation({
  args: {
    token: v.optional(v.string()),
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

    const updateData: any = {
      notionDatabaseId: args.databaseId !== undefined ? (args.databaseId || undefined) : user.notionDatabaseId,
      notionExportMethod: args.exportMethod !== undefined ? args.exportMethod : user.notionExportMethod,
      updatedAt: Date.now(),
    };

    // Only update token if a new one is provided
    if (args.token !== undefined) {
      updateData.notionToken = args.token;
    }

    await ctx.db.patch(user._id, updateData);
  },
});

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
      autoCreateFoldersFromNotionSubjects: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const updateAutoCreateFoldersFromNotionSubjects = mutation({
  args: {
    enabled: v.boolean(),
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
      autoCreateFoldersFromNotionSubjects: args.enabled,
      updatedAt: Date.now(),
    });

    return { enabled: args.enabled };
  },
});

export const anonymizeAccount = mutation({
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

    const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await ctx.db.patch(user._id, {
      clerkUserId: undefined,
      email: `${anonymousId}@anonymized.local`,
      preferredName: "Anonymous User",
      customGuidelines: undefined,
      defaultStructureHints: undefined,
      notionToken: undefined,
      notionDatabaseId: undefined,
      notionExportMethod: undefined,
      isAnonymized: true,
      anonymizedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, anonymousId };
  },
});

export const getAllUsersDebug = query({
  args: {},
  handler: async (ctx) => {
    if (process.env.NODE_ENV !== "development") {
      throw new Error("Not available in production");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const adminList = (process.env.ADMIN_CLERK_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!adminList.includes(identity.subject)) {
      throw new Error("Unauthorized");
    }

    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      subscriptionTier: u.subscriptionTier,
      isAnonymized: u.isAnonymized,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  },
});

export const fixSubscriptionTiers = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;
    
    for (const user of users) {
      if (!user.subscriptionTier) {
        await ctx.db.patch(user._id, {
          subscriptionTier: "free",
          updatedAt: Date.now(),
        });
        updated++;
      }
    }
    
    return { updated, total: users.length };
  },
});
