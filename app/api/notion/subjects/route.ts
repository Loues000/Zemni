import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { listSubjects } from "@/lib/notion";
import { trackError } from "@/lib/error-tracking";
import { decryptKey } from "@/lib/encryption";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fetches subjects from a Notion database, resolving the database ID and token from the request query/header, environment variables, or the authenticated user's stored configuration.
 *
 * @param request - The incoming HTTP Request. May include `databaseId` as a query parameter and `x-notion-token` as a header.
 * @returns A JSON object with a `subjects` array. On failure returns `{ subjects: [], error: string }` describing the failure.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userDatabaseId = searchParams.get("databaseId");
  const userToken = request.headers.get("x-notion-token");

  let databaseId = userDatabaseId || process.env.NOTION_SUBJECTS_DATABASE_ID;
  let notionToken = userToken || process.env.NOTION_TOKEN;

  // If no token provided via header, try to get from Convex (server-side decryption)
  if (!notionToken) {
    try {
      const { userId } = await auth();
      if (userId) {
        const user = await convex.query(api.users.getUserByClerkUserId, {
          clerkUserId: userId,
        });
        if (user?.notionToken) {
          notionToken = decryptKey(user.notionToken);
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