import { NextResponse } from "next/server";
import { exportSummary, ExportProgress, createNotionClient } from "@/lib/notion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const subjectId = body.subjectId ? String(body.subjectId) : undefined;
  const pageId = body.pageId ? String(body.pageId) : undefined;
  const title = String(body.title ?? "");
  const markdown = String(body.markdown ?? "");
  const stream = body.stream === true;
  const notionToken = body.notionToken || process.env.NOTION_TOKEN;

  if (!notionToken) {
    return NextResponse.json({ error: "Missing Notion token" }, { status: 400 });
  }

  if (!title || !markdown) {
    return NextResponse.json({ error: "Missing export data" }, { status: 400 });
  }

  // For database export, subjectId is required
  // For direct page export, pageId is optional (creates in workspace if not provided)
  const targetId = subjectId || pageId;

  // Non-streaming mode for backwards compatibility
  if (!stream) {
    const exportedPageId = await exportSummary(targetId, title, markdown, undefined, notionToken, pageId);
    return NextResponse.json({ pageId: exportedPageId });
  }

  // Streaming mode with NDJSON progress events
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ExportProgress) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch (e) {
          // Stream already closed
        }
      };

      try {
        await exportSummary(targetId, title, markdown, sendEvent, notionToken, pageId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        try {
          sendEvent({
            type: "error",
            message: errorMessage
          });
        } catch (e) {
          // Stream might be closed, try to send error anyway
        }
      } finally {
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      }
    }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
