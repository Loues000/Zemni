import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { encryptKey } from "@/lib/encryption";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Save the authenticated user's Notion configuration (encrypting the token) and persist it associated with their Clerk user ID.
 *
 * @param request - HTTP request with a JSON body containing `token` (required), and optional `databaseId` and `exportMethod`.
 * @returns A JSON response: on success `{ success: true }`; on error `{ error: string }` with an appropriate HTTP status code (`401` for unauthorized, `400` for bad request, `500` for server errors).
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token, databaseId, exportMethod } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Encrypt the token server-side before storing
    const encryptedToken = encryptKey(token);

    // Save to Convex with clerkUserId for auth
    await convex.mutation(api.users.updateNotionConfig, {
      token: encryptedToken,
      databaseId: databaseId || undefined,
      exportMethod: exportMethod || undefined,
      clerkUserId: userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save Notion config:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Clears the authenticated user's stored Notion configuration.
 *
 * @returns `{ success: true }` on success; `{ error: "Unauthorized" }` with HTTP status 401 if the request is not authenticated; `{ error: string }` with HTTP status 500 if an internal error occurs
 */
export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clear Notion configuration with clerkUserId for auth
    await convex.mutation(api.users.clearNotionConfig, {
      clerkUserId: userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear Notion config:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}