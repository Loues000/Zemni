import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, TIER_PRICE_IDS } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
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

    if (!tier || !["basic", "plus", "pro"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const priceId = TIER_PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { 
          error: `Price ID not configured for ${tier} tier. Please check STRIPE_PRICE_ID_${tier.toUpperCase()} environment variable.` 
        },
        { status: 500 }
      );
    }

    // Ensure user exists in Convex
    await convex.mutation(api.users.getOrCreateUser, {
      clerkUserId: userId,
      email: userEmail,
    });

    // Get user from Convex to check for existing Stripe customer
    // Use getUserByClerkUserId since getCurrentUser requires auth context
    const user = await convex.query(api.users.getUserByClerkUserId, {
      clerkUserId: userId,
    });
    if (!user) {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          clerkUserId: userId,
        },
      });
      customerId = customer.id;

      // Update user in Convex with Stripe customer ID
      await convex.mutation(api.stripe.updateSubscriptionByClerkUserId, {
        clerkUserId: userId,
        tier: user.subscriptionTier,
        stripeCustomerId: customerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
      });
    }

    // Create checkout session with customer
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3420"}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3420"}/settings?canceled=true`,
      client_reference_id: userId,
      metadata: {
        clerkUserId: userId,
        tier,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    // Provide more user-friendly error messages
    let userFriendlyError = "Unable to start checkout. Please try again.";
    if (errorMessage.includes("Price ID")) {
      userFriendlyError = "Subscription pricing is not configured. Please contact support.";
    } else if (errorMessage.includes("Unauthorized")) {
      userFriendlyError = "Please sign in to upgrade your subscription.";
    } else if (errorMessage.includes("not found")) {
      userFriendlyError = "Account not found. Please try signing out and back in.";
    }
    
    return NextResponse.json(
      { error: userFriendlyError },
      { status: 500 }
    );
  }
}
