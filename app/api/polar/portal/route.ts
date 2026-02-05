import { NextResponse } from "next/server";
import { polar } from "@/lib/polar";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getUserContext } from "@/lib/api-helpers";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Handles POST requests to open the Polar subscription management portal for the authenticated user.
 *
 * Attempts to authenticate the request, load the current user, verify an active paid subscription,
 * create a Polar customer session (by `polarCustomerId` or `clerkUserId`), and return the portal URL.
 *
 * @returns A JSON NextResponse containing `{ url: string }` when successful, or `{ error: string }` with an appropriate HTTP status on failure.
 */
export async function POST() {
  try {
    // Use getUserContext to verify authentication and get user
    const userContext = await getUserContext();
    if (!userContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get full user object to access polarCustomerId
    const user = await convex.query(api.users.getCurrentUser, {});
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.subscriptionTier !== "plus" && user.subscriptionTier !== "pro") {
      return NextResponse.json(
        { error: "No active subscription found. Please upgrade to a paid plan first." },
        { status: 400 }
      );
    }

    const session = await polar.customerSessions.create({
      ...(user.polarCustomerId ? { customerId: user.polarCustomerId } : { externalCustomerId: user.clerkUserId }),
    });

    const portalUrl =
      (session as any).customerPortalUrl || (session as any).customer_portal_url;

    if (!portalUrl) {
      return NextResponse.json(
        { error: "Unable to open subscription management. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error("Polar portal error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    // Provide user-friendly error messages
    let userFriendlyError = "Unable to open subscription management. Please try again.";
    if (errorMessage.includes("Unauthorized")) {
      userFriendlyError = "Please sign in to manage your subscription.";
    }

    return NextResponse.json({ error: userFriendlyError }, { status: 500 });
  }
}