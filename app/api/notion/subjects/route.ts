import { NextResponse } from "next/server";
import { listSubjects } from "@/lib/notion";
import { trackError } from "@/lib/error-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Check for user-provided Notion config (from localStorage, passed via query params or headers)
  // For now, fall back to environment variables
  const { searchParams } = new URL(request.url);
  const userDatabaseId = searchParams.get("databaseId");
  const userToken = request.headers.get("x-notion-token");

  const databaseId = userDatabaseId || process.env.NOTION_SUBJECTS_DATABASE_ID;
  const notionToken = userToken || process.env.NOTION_TOKEN;

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
        // Track auth errors as they indicate configuration issues
        trackError(error, {
          action: "notion_subjects_auth",
          metadata: { databaseId },
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
