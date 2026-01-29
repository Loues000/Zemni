import { NextResponse } from "next/server";
import { listSubjects } from "@/lib/notion";

export const runtime = "nodejs";

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
    return NextResponse.json({ subjects: [], error: "Failed to fetch subjects" });
  }
}
