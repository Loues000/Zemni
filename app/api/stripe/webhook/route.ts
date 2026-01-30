import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, getTierFromPriceId } from "@/lib/stripe";
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
          console.error("Missing metadata in checkout session", {
            clerkUserId,
            tier,
            metadata: session.metadata,
          });
          break;
        }

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Update user subscription using the correct mutation
        await convex.mutation(api.stripe.updateSubscriptionByClerkUserId, {
          clerkUserId,
          tier,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });

        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const subscriptionId = subscription.id;

        // Get the price ID from the subscription to determine tier
        const priceId = subscription.items.data[0]?.price.id;
        if (!priceId) {
          console.error("No price ID found in subscription");
          break;
        }

        const tier = getTierFromPriceId(priceId);
        if (!tier || tier === "free") {
          console.error("Invalid tier from price ID", { priceId, tier });
          break;
        }

        // Update user subscription by customer ID
        await convex.mutation(api.stripe.updateSubscriptionByCustomerId, {
          stripeCustomerId: customerId,
          tier,
          stripeSubscriptionId: subscriptionId,
        });

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const subscriptionId = subscription.id;

        // Determine tier from price ID
        const priceId = subscription.items.data[0]?.price.id;
        if (!priceId) {
          console.error("No price ID found in subscription");
          break;
        }

        const tier = getTierFromPriceId(priceId);
        if (!tier || tier === "free") {
          console.error("Invalid tier from price ID", { priceId, tier });
          break;
        }

        // Only update if subscription is active
        if (subscription.status === "active") {
          await convex.mutation(api.stripe.updateSubscriptionByCustomerId, {
            stripeCustomerId: customerId,
            tier,
            stripeSubscriptionId: subscriptionId,
          });
        } else {
          // If subscription is not active, set to free
          await convex.mutation(api.stripe.updateSubscriptionByCustomerId, {
            stripeCustomerId: customerId,
            tier: "free",
            stripeSubscriptionId: subscriptionId,
          });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Set tier to free when subscription is deleted
        await convex.mutation(api.stripe.updateSubscriptionByCustomerId, {
          stripeCustomerId: customerId,
          tier: "free",
          stripeSubscriptionId: undefined,
        });

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
