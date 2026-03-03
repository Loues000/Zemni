import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-server";
import { buildGuestRateLimitKey } from "@/lib/request-fingerprint";

type AuthContext = {
  userId: string | null;
  getToken: (options: { template: "convex" }) => Promise<string | null>;
};

/**
 * Enforces server-side generation rate limits for both authenticated and guest requests.
 */
export async function enforceGenerationRateLimit(
  request: Request,
  authContext: AuthContext,
  routeName: string
): Promise<NextResponse | null> {
  try {
    const convex = getConvexClient();

    if (authContext.userId) {
      const convexToken = await authContext.getToken({ template: "convex" });
      if (!convexToken) {
        console.error(`[${routeName}] Missing Convex auth token during rate-limit check`);
        return NextResponse.json(
          { error: "Service temporarily unavailable. Please try again shortly." },
          { status: 503 }
        );
      }

      convex.setAuth(convexToken);
      const rateLimit = await convex.mutation(api.rateLimits.checkRateLimit, {
        clerkUserId: authContext.userId,
        type: "generation",
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later.", retryAfter: rateLimit.retryAfter },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimit.retryAfter || 3600),
            },
          }
        );
      }

      return null;
    }

    const guestFingerprint = buildGuestRateLimitKey(request);
    if (!guestFingerprint.ok) {
      console.error(`[${routeName}] RATE_LIMIT_GUEST_SALT is not configured`);
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const rateLimit = await convex.mutation(api.rateLimits.checkRateLimit, {
      clerkUserId: guestFingerprint.key,
      type: "generation_guest",
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Guest limit reached (6 requests/hour). Please sign in to continue and unlock higher limits.",
          limitReached: true,
          limitType: "guest",
          upgradeHint: "Sign in or subscribe for higher generation limits.",
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter || 3600),
          },
        }
      );
    }

    return null;
  } catch (error) {
    console.error(`[${routeName}] Rate limit check failed`, error);
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
}

