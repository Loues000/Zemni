import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { polar } from "@/lib/polar";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-server";

/**
 * Create a Polar customer portal session for subscription management.
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = getConvexClient();

    // Get full user object to access polarCustomerId
    // Use getUserByClerkUserId since getCurrentUser requires auth context
    const user = await convex.query(api.users.getUserByClerkUserId, {
      clerkUserId: userId,
    });
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
