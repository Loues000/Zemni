import { NextResponse } from "next/server";
import { listSubjects } from "@/lib/notion";

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
    console.error("Notion subjects error:", error);
    
    // Provide more specific error messages
    let errorMessage = "Failed to fetch subjects";
    const errorAny = error as any;
    
    if (error instanceof Error) {
      // Check for Notion API specific error codes
      if (errorAny.code === "object_not_found" || errorAny.status === 404 || error.message.includes("Could not find database")) {
        errorMessage = "Database not found or not shared with your integration. Please check your database ID and ensure the database is shared with your Notion integration.";
      } else if (error.message.includes("timed out") || errorAny.code === "ETIMEDOUT") {
        errorMessage = "Request timed out. Please check your connection and try again.";
      } else if (errorAny.status === 401 || error.message.includes("401") || error.message.includes("Unauthorized")) {
        errorMessage = "Invalid Notion token. Please check your integration settings.";
      } else if (error.message.includes("404") || error.message.includes("Not found")) {
        errorMessage = "Database not found. Please check your database ID.";
      } else {
        errorMessage = error.message || errorMessage;
      }
    }
    
    // Return 200 with error message instead of 500 to allow frontend to handle gracefully
    return NextResponse.json(
      { subjects: [], error: errorMessage },
      { status: 200 }
    );
  }
}
