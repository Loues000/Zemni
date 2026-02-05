import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { listSubjects } from "@/lib/notion";
import { trackError } from "@/lib/error-tracking";
import { decryptKey } from "@/lib/encryption";
import { getConvexClient } from "@/lib/convex-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fetch Notion subject list using configured database and token.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const envDatabaseId = process.env.NOTION_SUBJECTS_DATABASE_ID;
  const envNotionToken = process.env.NOTION_TOKEN;

  const userDatabaseId = searchParams.get("databaseId")?.trim() || null;
  const userToken = request.headers.get("x-notion-token")?.trim() || null;

  let databaseId = userDatabaseId || envDatabaseId;
  let notionToken = userToken || envNotionToken;
  let tokenSource: "header" | "env" | "convex" | "none" = userToken
    ? "header"
    : notionToken
      ? "env"
      : "none";

  // If no token provided via header, try to get from Convex (server-side decryption)
  if (!notionToken) {
    try {
      const { userId } = await auth();
      if (userId) {
        const convex = getConvexClient();
        const user = await convex.query(api.users.getUserByClerkUserId, {
          clerkUserId: userId,
        });
        if (user?.notionToken) {
          notionToken = decryptKey(user.notionToken);
          tokenSource = "convex";
          if (!databaseId && user.notionDatabaseId) {
            databaseId = user.notionDatabaseId;
          }
        }
      }
    } catch (error) {
      // Fall back to env var if Convex lookup fails
      console.warn("Failed to get Notion config from Convex:", error);
    }
  }

  // Guard: never allow using the env NOTION_TOKEN against a caller-supplied databaseId.
  // Env token may only be used for the default database.
  if (userDatabaseId && !userToken && tokenSource === "env") {
    if (!envDatabaseId || databaseId !== envDatabaseId) {
      return NextResponse.json({ subjects: [], error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!databaseId || !notionToken) {
    return NextResponse.json({ subjects: [] });
  }

  try {
    const subjects = await listSubjects(databaseId, notionToken);
    return NextResponse.json({ subjects });
  } catch (error) {
    const errorAny = error as any;
    const isNotFoundError = 
      errorAny.code === "object_not_found" || 
      errorAny.status === 404 || 
      (error instanceof Error && error.message.includes("Could not find database"));
      
    // Provide more specific error messages
    let errorMessage = "Failed to fetch subjects";
    
    if (error instanceof Error) {
      // Check for Notion API specific error codes
      if (isNotFoundError) {
        errorMessage = "Database not found or not shared with your integration. Please check your database ID and ensure the database is shared with your Notion integration.";
        // Log expected 404 errors at a lower level to reduce console noise
        console.warn(`[Notion] Database not found: ${databaseId}`);
      } else if (error.message.includes("timed out") || errorAny.code === "ETIMEDOUT") {
        errorMessage = "Request timed out. Please check your connection and try again.";
        // Track timeout errors as they might indicate infrastructure issues
        trackError(error, {
          action: "notion_subjects_timeout",
          metadata: { databaseId },
        });
      } else if (errorAny.status === 401 || error.message.includes("401") || error.message.includes("Unauthorized")) {
        errorMessage = "Invalid Notion token. Please check your integration settings.";
        // Track auth errors silently (still sent to Sentry for monitoring, but don't spam console)
        trackError(error, {
          action: "notion_subjects_auth",
          metadata: { databaseId },
          silent: true,
        });
      } else {
        errorMessage = error.message || errorMessage;
        // Track unexpected errors
        trackError(error, {
          action: "notion_subjects_unexpected",
          metadata: { databaseId, errorCode: errorAny.code, status: errorAny.status },
        });
      }
    }
    
    // Return 200 with error message instead of 500 to allow frontend to handle gracefully
    return NextResponse.json(
      { subjects: [], error: errorMessage },
      { status: 200 }
    );
  }
}
