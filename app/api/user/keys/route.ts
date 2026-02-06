import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { encryptKey } from "@/lib/encryption";
import { validateApiKeyFormat, getValidationErrorMessage, type ApiProvider } from "@/lib/api-key-validation";

/**
 * Return metadata for the current user's API keys.
 */
export async function GET() {
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
      { error: "Failed to retrieve API keys. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Store an encrypted API key for the current user.
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

    // Check rate limit (using Convex for persistence)
    try {
      const rateLimit = await convex.mutation(api.rateLimits.checkRateLimit, {
        userId: userId,
        type: "key_management",
      });
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
    } catch (error) {
      // If Convex call fails, log but allow request (fail open for availability)
      console.error("Rate limit check failed:", error);
      // Continue with request - rate limiting is a protection, not a blocker
    }

    const body = await request.json();
    const { provider, key } = body;
    const trimmedKey = typeof key === "string" ? key.trim() : String(key ?? "").trim();

    if (!provider || !trimmedKey) {
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
    if (!validateApiKeyFormat(provider as ApiProvider, trimmedKey)) {
      return NextResponse.json(
        { error: getValidationErrorMessage(provider as ApiProvider) },
        { status: 400 }
      );
    }

    // Encrypt the key
    let encryptedKey: string;
    try {
      encryptedKey = encryptKey(trimmedKey);
    } catch (error) {
      console.error("Encryption error:", error);
      return NextResponse.json(
        { error: "Configuration error. Please contact support." },
        { status: 500 }
      );
    }

    // Save to Convex with authenticated context
    try {
      await convex.mutation(api.apiKeys.upsertKey, {
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

/**
 * Delete a stored API key for the current user.
 */
export async function DELETE(request: Request) {
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

    // Check rate limit (using Convex for persistence)
    try {
      const rateLimit = await convex.mutation(api.rateLimits.checkRateLimit, {
        userId: userId,
        type: "key_management",
      });
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
    } catch (error) {
      // If Convex call fails, log but allow request (fail open for availability)
      console.error("Rate limit check failed:", error);
      // Continue with request - rate limiting is a protection, not a blocker
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("keyId");

    if (!keyId) {
      return NextResponse.json({ error: "keyId is required" }, { status: 400 });
    }

    // Delete from Convex with authenticated context
    try {
      await convex.mutation(api.apiKeys.deleteKey, {
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
