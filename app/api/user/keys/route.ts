import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { encryptKey } from "@/lib/encryption";
import { validateApiKeyFormat, getValidationErrorMessage, type ApiProvider } from "@/lib/api-key-validation";

// Create unauthenticated Convex client (auth happens via clerkUserId param)
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Retrieve the authenticated user's API key metadata (excluding secret key values).
 *
 * @returns A NextResponse containing a JSON object with a `keys` array; each entry includes `id`, `provider`, `isActive`, `lastUsed`, and `useOwnKey`. On failure returns a JSON error response with an appropriate HTTP status.
 */
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

/**
 * Creates or updates an authenticated user's API key for a supported provider.
 *
 * Validates request body (`provider` and `key`), enforces provider-specific key format, applies rate limiting, encrypts the key, and persists it tied to the authenticated user.
 *
 * @param request - Incoming HTTP request whose JSON body must include `provider` (one of "openrouter", "openai", "anthropic", "google") and `key` (the provider API key to store)
 * @returns A JSON response object. On success: `{ success: true }`. On failure: `{ error: string }` with an appropriate HTTP status code (`400` for validation/format errors or invalid JSON, `401` for unauthenticated requests, `429` for rate-limited requests, `500` for server/encryption/persistence errors)
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

/**
 * Delete the authenticated user's API key specified by the `keyId` query parameter, enforcing authentication and rate limiting.
 *
 * @returns A JSON response with `{ success: true }` on successful deletion, or an error object and corresponding HTTP status: `401` if unauthenticated, `400` if `keyId` is missing, `429` if rate limited, and `500` for server-side failures.
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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