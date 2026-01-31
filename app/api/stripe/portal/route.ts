import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getUserContext } from "@/lib/api-helpers";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  try {
    // Use getUserContext to verify authentication and get user
    const userContext = await getUserContext();
    if (!userContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get full user object to access stripeCustomerId
    const user = await convex.query(api.users.getCurrentUser, {});
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found. Please upgrade to a paid plan first." },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3420"}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    // Provide user-friendly error messages
    let userFriendlyError = "Unable to open subscription management. Please try again.";
    if (errorMessage.includes("No active subscription")) {
      userFriendlyError = "You don't have an active subscription to manage.";
    } else if (errorMessage.includes("Unauthorized")) {
      userFriendlyError = "Please sign in to manage your subscription.";
    }
    
    return NextResponse.json(
      { error: userFriendlyError },
      { status: 500 }
    );
  }
}
