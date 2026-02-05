import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { polar, TIER_PRODUCT_IDS } from "@/lib/polar";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Initiates a Polar subscription checkout for the authenticated user based on the requested tier.
 *
 * Validates billing is enabled, ensures the caller is signed in, resolves the user's email,
 * verifies the requested `tier` is "plus" or "pro", ensures the user exists in the Convex DB,
 * and creates a Polar checkout that returns a redirect URL.
 *
 * @param request - HTTP request whose JSON body must include a `tier` field ("plus" or "pro")
 * @returns A NextResponse JSON object. On success: `{ url: string }`. On error: `{ error: string }` with an appropriate HTTP status code.
 */
export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_BILLING !== "true") {
      return NextResponse.json(
        { error: "Subscriptions are coming soon. Purchases are currently disabled." },
        { status: 503 }
      );
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from Clerk to get email
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userEmail = clerkUser.emailAddresses[0]?.emailAddress || `${userId}@clerk.user`;

    const body = await request.json();
    const { tier } = body;

    // "basic" tier is automatically awarded to all logged-in users, not a paid tier
    if (!tier || !["plus", "pro"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const productId = TIER_PRODUCT_IDS[tier];
    if (!productId) {
      return NextResponse.json(
        {
          error: `Product ID not configured for ${tier} tier. Please check POLAR_PRODUCT_ID_${tier.toUpperCase()} environment variable.`,
        },
        { status: 500 }
      );
    }

    // Ensure user exists in Convex
    await convex.mutation(api.users.getOrCreateUser, {
      clerkUserId: userId,
      email: userEmail,
    });

    // Get user from Convex to check for existing Polar customer
    // Use getUserByClerkUserId since getCurrentUser requires auth context
    const user = await convex.query(api.users.getUserByClerkUserId, {
      clerkUserId: userId,
    });
    if (!user) {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }

    const successUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3420"}/settings?success=true`;

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl,
      ...(user.polarCustomerId ? { customerId: user.polarCustomerId } : { externalCustomerId: userId }),
    });

    const checkoutUrl =
      (checkout as any).url || (checkout as any).checkoutUrl || (checkout as any).checkout_url;

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Unable to start checkout. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error("Polar checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    // Provide more user-friendly error messages
    let userFriendlyError = "Unable to start checkout. Please try again.";
    if (errorMessage.includes("Product ID")) {
      userFriendlyError = "Subscription pricing is not configured. Please contact support.";
    } else if (errorMessage.includes("Unauthorized")) {
      userFriendlyError = "Please sign in to upgrade your subscription.";
    } else if (errorMessage.includes("not found")) {
      userFriendlyError = "Account not found. Please try signing out and back in.";
    }

    return NextResponse.json({ error: userFriendlyError }, { status: 500 });
  }
}