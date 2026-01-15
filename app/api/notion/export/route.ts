import { NextResponse } from "next/server";
import { exportSummary } from "@/lib/notion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const subjectId = String(body.subjectId ?? "");
  const title = String(body.title ?? "");
  const markdown = String(body.markdown ?? "");

  if (!process.env.NOTION_TOKEN) {
    return NextResponse.json({ error: "Missing Notion token" }, { status: 400 });
  }

  if (!subjectId || !title || !markdown) {
    return NextResponse.json({ error: "Missing export data" }, { status: 400 });
  }

  const pageId = await exportSummary(subjectId, title, markdown);
  return NextResponse.json({ pageId });
}
