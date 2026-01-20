import { NextResponse } from "next/server";
import { exportSummary, ExportProgress } from "@/lib/notion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const subjectId = String(body.subjectId ?? "");
  const title = String(body.title ?? "");
  const markdown = String(body.markdown ?? "");
  const stream = body.stream === true;

  if (!process.env.NOTION_TOKEN) {
    return NextResponse.json({ error: "Missing Notion token" }, { status: 400 });
  }

  if (!subjectId || !title || !markdown) {
    return NextResponse.json({ error: "Missing export data" }, { status: 400 });
  }

  // Non-streaming mode for backwards compatibility
  if (!stream) {
    const pageId = await exportSummary(subjectId, title, markdown);
    return NextResponse.json({ pageId });
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
        await exportSummary(subjectId, title, markdown, sendEvent);
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
