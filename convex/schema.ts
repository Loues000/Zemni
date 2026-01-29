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
    .index("by_user_id_updated", ["userId", "updatedAt"]),

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
