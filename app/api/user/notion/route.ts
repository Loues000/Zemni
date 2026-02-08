import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { encryptKey } from "@/lib/encryption";

/**
 * Save the user's Notion integration configuration.
 */
export async function POST(request: Request) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);

    const body = await request.json();
    const { token, databaseId, exportMethod } = body;

    // Prepare update data
    const updateData: {
      token?: string;
      databaseId?: string;
      exportMethod?: "database" | "page";
    } = {
      databaseId: databaseId || undefined,
      exportMethod: exportMethod || undefined,
    };

    // Only encrypt and include token if a new one is provided
    if (token) {
      const encryptedToken = encryptKey(token);
      updateData.token = encryptedToken;
    }

    // Save to Convex with authenticated context
    await convex.mutation(api.users.updateNotionConfig, updateData);

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
 * Clear the user's Notion integration configuration.
 */
export async function DELETE() {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);

    // Clear Notion configuration with authenticated context
    await convex.mutation(api.users.clearNotionConfig, {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear Notion config:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
