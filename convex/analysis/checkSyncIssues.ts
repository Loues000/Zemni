import { query } from "../_generated/server";

/**
 * Compare timestamps between documents and usage to check for sync issues
 */
export default query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { error: "Not authenticated" };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return { error: "User not found" };
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .collect();

    // Find sync issues
    const issues: any[] = [];
    
    // Group usage by document
    const usageByDoc = new Map<string, any[]>();
    for (const u of usage) {
      if (u.documentId) {
        const arr = usageByDoc.get(u.documentId) || [];
        arr.push(u);
        usageByDoc.set(u.documentId, arr);
      }
    }

    for (const doc of documents) {
      const docUsage = usageByDoc.get(doc._id) || [];
      
      if (docUsage.length === 0) {
        issues.push({
          type: "orphaned_document",
          documentId: doc._id,
          title: doc.title,
          message: "Document exists but has no usage entries",
        });
        continue;
      }
      
      // Find earliest usage
      const earliestUsage = docUsage.reduce((min: any, u: any) => 
        u.timestamp < min.timestamp ? u : min
      );
      
      // Check if document createdAt roughly matches earliest usage
      const timeDiff = Math.abs(doc.createdAt - earliestUsage.timestamp);
      const oneHour = 60 * 60 * 1000;
      
      if (timeDiff > oneHour) {
        issues.push({
          type: "timestamp_mismatch",
          documentId: doc._id,
          title: doc.title,
          message: `Document createdAt (${new Date(doc.createdAt).toISOString()}) differs from earliest usage (${new Date(earliestUsage.timestamp).toISOString()}) by ${Math.round(timeDiff / 1000 / 60)} minutes`,
        });
      }
    }

    return {
      totalIssues: issues.length,
      issues: issues.slice(0, 20), // Limit to first 20
    };
  },
});
