import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { exportSummary, ExportProgress, createNotionClient } from "@/lib/notion";
import { decryptKey } from "@/lib/encryption";
import { getConvexClient } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * Export markdown summaries to Notion (streaming or non-streaming).
 */
export async function POST(request: Request) {
  const body = await request.json();
  const subjectId = body.subjectId ? String(body.subjectId) : undefined;
  const pageId = body.pageId ? String(body.pageId) : undefined;
  const title = String(body.title ?? "");
  const markdown = String(body.markdown ?? "");
  const stream = body.stream === true;
  let notionToken = body.notionToken || process.env.NOTION_TOKEN;

  // If token is encrypted (from Convex), decrypt it server-side
  // Encrypted tokens contain colons (iv:tag:encrypted format)
  if (notionToken && notionToken.includes(":") && notionToken.split(":").length === 3) {
    try {
      notionToken = decryptKey(notionToken);
    } catch (error) {
      // If decryption fails, it might be a plain token, continue with it
      console.warn("Failed to decrypt token, using as-is:", error);
    }
  }

  // If no token provided, try to get from Convex (server-side decryption)
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
        }
      }
    } catch (error) {
      // Fall back to env var if Convex lookup fails
      console.warn("Failed to get Notion config from Convex:", error);
    }
  }

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
    /**
     * Stream Notion export progress updates as NDJSON events.
     */
    async start(controller) {
      /**
       * Enqueue a progress event into the stream.
       */
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
