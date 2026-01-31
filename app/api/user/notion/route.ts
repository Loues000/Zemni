import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { encryptKey } from "@/lib/encryption";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

    // Save to Convex
    await convex.mutation(api.users.updateNotionConfig, {
      token: encryptedToken,
      databaseId: databaseId || undefined,
      exportMethod: exportMethod || undefined,
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

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clear Notion configuration
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
