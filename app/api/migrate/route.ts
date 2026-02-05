import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { loadHistoryFromStorage, isHistoryEntry, historyEntryToDocument } from "@/lib/history-storage";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Migrates valid history entries from the browser's local storage into Convex for the authenticated user.
 *
 * Attempts to upsert each valid local history entry as a Convex document tied to the current user's Convex ID. Responds with a summary of how many entries were migrated and the total examined. Returns appropriate HTTP error responses when the request is unauthenticated or the user is not found in Convex, and a 500 response for unexpected failures.
 *
 * @returns A JSON payload describing the result:
 * - On success: `{ message: string, migrated: number, total: number }` where `migrated` is the number of entries successfully migrated and `total` is the number of valid entries processed.
 * - On authentication failure: `{ error: "Unauthorized" }` with HTTP status 401.
 * - If the Convex user is not found: `{ error: "User not found in Convex" }` with HTTP status 404.
 * - On unexpected errors: `{ error: string }` with HTTP status 500 (error message when available).
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from Convex
    const user = await convex.query(api.users.getCurrentUser as any, {});

    if (!user) {
      return NextResponse.json({ error: "User not found in Convex" }, { status: 404 });
    }

    // Load history from localStorage
    const localStorageHistory = loadHistoryFromStorage();
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