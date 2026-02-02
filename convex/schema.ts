import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    subscriptionTier: v.union(
      v.literal("free"),
      v.literal("basic"),
      v.literal("plus"),
      v.literal("pro")
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    customGuidelines: v.optional(v.string()),
    defaultStructureHints: v.optional(v.string()),
    notionToken: v.optional(v.string()),
    notionDatabaseId: v.optional(v.string()),
    notionExportMethod: v.optional(v.union(v.literal("database"), v.literal("page"))),
    isAnonymized: v.optional(v.boolean()),
    anonymizedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user_id", ["clerkUserId"]),

  documents: defineTable({
    userId: v.id("users"),
    title: v.string(),
    fileName: v.string(),
    extractedText: v.string(),
    outputs: v.any(), // Record<string, OutputEntry>
    structureHints: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    exportedSubject: v.optional(v.string()),
    notionPageId: v.optional(v.string()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_id_updated", ["userId", "updatedAt"])
    .index("by_user_file_content", ["userId", "fileName"]),

  apiKeys: defineTable({
    userId: v.id("users"),
    provider: v.union(
      v.literal("openrouter"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google")
    ),
    keyHash: v.string(), // Encrypted key
    isActive: v.boolean(),
    useOwnKey: v.optional(v.boolean()), // Global preference
    createdAt: v.number(),
    lastUsed: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_provider", ["userId", "provider"]),

  usage: defineTable({
    userId: v.id("users"),
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
    timestamp: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_timestamp", ["userId", "timestamp"])
    .index("by_document_id", ["documentId"]),
});
