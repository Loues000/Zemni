import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { encryptKey, decryptKey } from "@/lib/encryption";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user keys from Convex
    // Note: In production, use proper authenticated Convex queries
    const keys = await convex.query(api.apiKeys.getUserKeys, {});

    // Return keys without the actual key values (for security)
    return NextResponse.json({
      keys: keys.map((key: any) => ({
        id: key._id,
        provider: key.provider,
        isActive: key.isActive,
        lastUsed: key.lastUsed,
        useOwnKey: key.useOwnKey,
      })),
    });
  } catch (error) {
    console.error("Failed to get API keys:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { provider, key } = body;

    if (!provider || !key) {
      return NextResponse.json({ error: "Provider and key are required" }, { status: 400 });
    }

    // Encrypt the key
    const encryptedKey = encryptKey(key);

    // Save to Convex
    await convex.mutation(api.apiKeys.upsertKey, {
      provider: provider as any,
      keyHash: encryptedKey,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save API key:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("keyId");

    if (!keyId) {
      return NextResponse.json({ error: "keyId is required" }, { status: 400 });
    }

    await convex.mutation(api.apiKeys.deleteKey, {
      keyId: keyId as any,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete API key:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
