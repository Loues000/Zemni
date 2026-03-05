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
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }

    // Parse request body to get history data from client
    const body = await request.json();
    const localStorageHistory = body.history || [];

    if (!Array.isArray(localStorageHistory)) {
      return NextResponse.json({ error: "Invalid request: history must be an array" }, { status: 400 });
    }

    const convex = getConvexClient();
    convex.setAuth(convexToken);

    // Validate history entries
    const validEntries = localStorageHistory.filter(isHistoryEntry);

    if (validEntries.length === 0) {
      return NextResponse.json({ message: "No history to migrate", migrated: 0 });
    }

    // Migrate each entry to Convex
    let migrated = 0;
    let failed = 0;
    for (const entry of validEntries) {
      try {
        const docData = historyEntryToDocument(entry, userId);
        await convex.mutation(api.documents.upsert, docData as any);
        migrated++;
      } catch (err) {
        failed++;
        console.error(`Failed to migrate entry ${entry.id}:`, err);
      }
    }

    if (failed > 0) {
      return NextResponse.json(
        {
          error: `Migrated ${migrated} of ${validEntries.length} entries`,
          migrated,
          failed,
          total: validEntries.length,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Migrated ${migrated} of ${validEntries.length} entries`,
      migrated,
      failed,
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
