import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * List documents for current user
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { documents: [], nextCursor: undefined };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return { documents: [], nextCursor: undefined };
    }

    const limit = args.limit ?? 50;
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_user_id_updated", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return {
      documents,
      nextCursor: documents.length === limit ? documents[documents.length - 1]._id : undefined,
    };
  },
});

/**
 * Get document by ID
 */
export const get = query({
  args: { documentId: v.id("documents") },
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

    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== user._id) {
      return null;
    }

    return doc;
  },
});

/**
 * Create or update document
 */
export const upsert = mutation({
  args: {
    documentId: v.optional(v.id("documents")),
    title: v.string(),
    fileName: v.string(),
    extractedText: v.string(),
    outputs: v.any(),
    structureHints: v.string(),
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

    const now = Date.now();

    if (args.documentId) {
      // Update existing
      const existing = await ctx.db.get(args.documentId);
      if (!existing || existing.userId !== user._id) {
        throw new Error("Document not found");
      }

      await ctx.db.patch(args.documentId, {
        title: args.title,
        fileName: args.fileName,
        extractedText: args.extractedText,
        outputs: args.outputs,
        structureHints: args.structureHints,
        updatedAt: now,
      });

      return args.documentId;
    } else {
      // Create new
      return await ctx.db.insert("documents", {
        userId: user._id,
        title: args.title,
        fileName: args.fileName,
        extractedText: args.extractedText,
        outputs: args.outputs,
        structureHints: args.structureHints,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Delete document
 */
export const remove = mutation({
  args: { documentId: v.id("documents") },
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

    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== user._id) {
      throw new Error("Document not found");
    }

    await ctx.db.delete(args.documentId);
  },
});

/**
 * Search documents
 */
export const search = query({
  args: {
    query: v.string(),
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

    const limit = args.limit ?? 50;
    const searchLower = args.query.toLowerCase();

    const allDocs = await ctx.db
      .query("documents")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    const filtered = allDocs
      .filter(
        (doc: any) =>
          doc.title.toLowerCase().includes(searchLower) ||
          doc.fileName.toLowerCase().includes(searchLower)
      )
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

    return filtered;
  },
});
