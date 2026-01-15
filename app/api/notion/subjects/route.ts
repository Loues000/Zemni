import { NextResponse } from "next/server";
import { listSubjects } from "@/lib/notion";

export const runtime = "nodejs";

export async function GET() {
  const databaseId = process.env.NOTION_SUBJECTS_DATABASE_ID;
  const notionToken = process.env.NOTION_TOKEN;
  if (!databaseId || !notionToken) {
    return NextResponse.json({ subjects: [] });
  }

  const subjects = await listSubjects(databaseId);
  return NextResponse.json({ subjects });
}
