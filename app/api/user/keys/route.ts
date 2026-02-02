import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { encryptKey } from "@/lib/encryption";
import { validateApiKeyFormat, getValidationErrorMessage, type ApiProvider } from "@/lib/api-key-validation";
import { checkRateLimit } from "@/lib/rate-limit";

// Create unauthenticated Convex client (auth happens via clerkUserId param)
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user keys from Convex using clerkUserId
    const keys = await convex.query(api.apiKeys.getUserKeys, { clerkUserId: userId });

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
      { error: "Failed to retrieve API keys. Please try again." },
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

    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter || 3600),
          },
        }
      );
    }

    const body = await request.json();
    const { provider, key } = body;

    if (!provider || !key) {
      return NextResponse.json({ error: "Provider and key are required" }, { status: 400 });
    }

    // Validate provider
    const validProviders: ApiProvider[] = ["openrouter", "openai", "anthropic", "google"];
    if (!validProviders.includes(provider as ApiProvider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate key format (prefix check only)
    if (!validateApiKeyFormat(provider as ApiProvider, key)) {
      return NextResponse.json(
        { error: getValidationErrorMessage(provider as ApiProvider) },
        { status: 400 }
      );
    }

    // Encrypt the key
    let encryptedKey: string;
    try {
      encryptedKey = encryptKey(key);
    } catch (error) {
      console.error("Encryption error:", error);
      return NextResponse.json(
        { error: "Configuration error. Please contact support." },
        { status: 500 }
      );
    }

    // Save to Convex with clerkUserId for auth
    try {
      await convex.mutation(api.apiKeys.upsertKey, {
        clerkUserId: userId,
        provider: provider as ApiProvider,
        keyHash: encryptedKey,
      });
    } catch (error) {
      console.error("Failed to save API key to database:", error);
      return NextResponse.json(
        { error: "Failed to save API key. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }

    console.error("Failed to save API key:", error);
    return NextResponse.json(
      { error: "Failed to save API key. Please try again." },
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

    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter || 3600),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("keyId");

    if (!keyId) {
      return NextResponse.json({ error: "keyId is required" }, { status: 400 });
    }

    // Delete from Convex with clerkUserId for auth
    try {
      await convex.mutation(api.apiKeys.deleteKey, {
        clerkUserId: userId,
        keyId: keyId as any,
      });
    } catch (error) {
      console.error("Failed to delete API key from database:", error);
      return NextResponse.json(
        { error: "Failed to delete API key. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key. Please try again." },
      { status: 500 }
    );
  }
}
