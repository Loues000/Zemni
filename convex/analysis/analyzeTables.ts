import { query } from "../_generated/server";

/**
 * Analyze the relationship between documents and usage tables
 * Shows the fundamental differences between these two tables
 */
export default query({
  args: {},
  handler: async (ctx) => {
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

    // Get ALL documents and usage (admin-only analysis)
    const allDocuments = await ctx.db.query("documents").collect();
    const allUsage = await ctx.db.query("usage").collect();
    const allUsers = await ctx.db.query("users").collect();

    // STRUCTURAL DIFFERENCES
    const structuralDiffs = {
      documentsPurpose: "Stores uploaded PDFs with extracted text and generated outputs (summary, flashcards, quiz)",
      usagePurpose: "Tracks API calls - every LLM operation with token counts and costs",
      
      documentsSchema: {
        userId: "Reference to user",
        title: "Document title",
        fileName: "Original filename",
        extractedText: "Full PDF text content",
        outputs: "Generated content (summary, flashcards, quiz)",
        structureHints: "User-defined structure preferences",
        createdAt: "When document was first uploaded",
        updatedAt: "Last modification time",
      },
      
      usageSchema: {
        userId: "Reference to user",
        documentId: "OPTIONAL - which document this operation was for",
        source: "Type: summarize, refine, flashcards, quiz, section-summary",
        tokensIn: "Input tokens sent to LLM",
        tokensOut: "Output tokens received from LLM",
        cost: "Calculated cost in USD",
        modelId: "Which AI model was used",
        timestamp: "When the API call happened",
      },
    };

    // QUANTITY ANALYSIS
    const quantityAnalysis = {
      totalDocuments: allDocuments.length,
      totalUsageEntries: allUsage.length,
      totalUsers: allUsers.length,
      ratio: allDocuments.length > 0 ? (allUsage.length / allDocuments.length).toFixed(2) : "N/A",
    };

    // CARDINALITY ANALYSIS
    // How many documents have usage entries?
    const docIdsWithUsage = new Set(allUsage.filter(u => u.documentId).map(u => u.documentId));
    const allDocIds = new Set(allDocuments.map(d => d._id));
    
    const cardinality = {
      documentsWithUsage: docIdsWithUsage.size,
      documentsWithoutUsage: allDocuments.length - docIdsWithUsage.size,
      usageWithDocumentReference: allUsage.filter(u => u.documentId).length,
      usageWithoutDocumentReference: allUsage.filter(u => !u.documentId).length,
    };

    // USAGE PATTERNS
    const usagePatterns = {
      bySource: {} as Record<string, number>,
      documentsWithMultipleOperations: 0,
      documentsWithSingleOperation: 0,
      maxOperationsPerDocument: 0,
    };

    // Count by source type
    for (const u of allUsage) {
      usagePatterns.bySource[u.source] = (usagePatterns.bySource[u.source] || 0) + 1;
    }

    // Count operations per document
    const opsPerDoc = new Map<string, number>();
    for (const u of allUsage) {
      if (u.documentId) {
        opsPerDoc.set(u.documentId, (opsPerDoc.get(u.documentId) || 0) + 1);
      }
    }

    for (const count of opsPerDoc.values()) {
      if (count > 1) {
        usagePatterns.documentsWithMultipleOperations++;
        if (count > usagePatterns.maxOperationsPerDocument) {
          usagePatterns.maxOperationsPerDocument = count;
        }
      } else {
        usagePatterns.documentsWithSingleOperation++;
      }
    }

    // SAMPLE DOCUMENT (show what documents table actually stores)
    const sampleDocument = allDocuments.length > 0 ? {
      id: allDocuments[0]._id,
      title: allDocuments[0].title,
      fileName: allDocuments[0].fileName,
      textLength: allDocuments[0].extractedText?.length || 0,
      hasOutputs: !!allDocuments[0].outputs,
      outputTypes: allDocuments[0].outputs ? Object.keys(allDocuments[0].outputs) : [],
      createdAt: new Date(allDocuments[0].createdAt).toISOString(),
    } : null;

    // SAMPLE USAGE ENTRIES (show what usage table actually stores)
    const sampleUsage = allUsage.slice(0, 5).map(u => ({
      id: u._id,
      source: u.source,
      hasDocumentRef: !!u.documentId,
      documentId: u.documentId,
      tokensIn: u.tokensIn,
      tokensOut: u.tokensOut,
      cost: u.cost,
      modelId: u.modelId,
      timestamp: new Date(u.timestamp).toISOString(),
    }));

    // REAL-WORLD SCENARIO EXAMPLES
    const scenarios = [
      {
        scenario: "User uploads PDF",
        documentsEffect: "1 new row with extracted text",
        usageEffect: "1 usage entry (summarize) with token counts",
      },
      {
        scenario: "User refines summary",
        documentsEffect: "Document row updated (new summary in outputs)",
        usageEffect: "1 usage entry (refine) with token counts",
      },
      {
        scenario: "User generates flashcards",
        documentsEffect: "Document row updated (flashcards added to outputs)",
        usageEffect: "1 usage entry (flashcards) with token counts",
      },
      {
        scenario: "User generates quiz",
        documentsEffect: "Document row updated (quiz added to outputs)",
        usageEffect: "1 usage entry (quiz) with token counts",
      },
      {
        scenario: "User views document later",
        documentsEffect: "No change - just reading",
        usageEffect: "No usage entry - no API call",
      },
    ];

    return {
      structuralDifferences: structuralDiffs,
      quantityAnalysis,
      cardinality,
      usagePatterns,
      sampleDocument,
      sampleUsage,
      scenarios,
      
      keyInsight: cardinality.documentsWithoutUsage > 0 
        ? `${cardinality.documentsWithoutUsage} documents exist without any usage entries - these might be test uploads or orphaned data`
        : "All documents have at least one associated usage entry",
    };
  },
});
