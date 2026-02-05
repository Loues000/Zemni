import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { isHistoryEntry, historyEntryToDocument } from "@/lib/history-storage";
import { getConvexClient } from "@/lib/convex-server";

/**
 * Migrate local history entries into Convex for an authenticated user.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body to get history data from client
    const body = await request.json();
    const localStorageHistory = body.history || [];

    if (!Array.isArray(localStorageHistory)) {
      return NextResponse.json({ error: "Invalid request: history must be an array" }, { status: 400 });
    }

    const convex = getConvexClient();

    // Get user from Convex
    const user = await convex.query(api.users.getCurrentUser as any, {});

    if (!user) {
      return NextResponse.json({ error: "User not found in Convex" }, { status: 404 });
    }

    // Validate history entries
    const validEntries = localStorageHistory.filter(isHistoryEntry);

    if (validEntries.length === 0) {
      return NextResponse.json({ message: "No history to migrate", migrated: 0 });
    }

    // Migrate each entry to Convex
    let migrated = 0;
    for (const entry of validEntries) {
      try {
        const docData = historyEntryToDocument(entry, user._id);
        await convex.mutation(api.documents.upsert, {
          documentId: entry.id as any, // Try to use existing ID
          ...docData,
        });
        migrated++;
      } catch (err) {
        console.error(`Failed to migrate entry ${entry.id}:`, err);
      }
    }

    return NextResponse.json({
      message: `Migrated ${migrated} of ${validEntries.length} entries`,
      migrated,
      total: validEntries.length,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
