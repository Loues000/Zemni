import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import Stripe from "stripe";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerkUserId;
        const tier = session.metadata?.tier as "basic" | "plus" | "pro";

        if (!clerkUserId || !tier) {
          console.error("Missing metadata in checkout session");
          break;
        }

        // Get or create user in Convex
        // Note: This requires proper authentication. For now, we'll use a mutation
        // In production, you'd want to use Convex actions or authenticated mutations
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Update user subscription
        // This is a simplified approach - in production, use proper Convex mutations with auth
        await convex.mutation(api.users.updateSubscriptionTier, {
          userId: "" as any, // This needs to be resolved from clerkUserId
          tier,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID and update subscription
        // In production, you'd query Convex to find the user
        const tier = subscription.status === "active" ? subscription.metadata?.tier : "free";

        // Update subscription status
        // This needs proper implementation with Convex queries
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
