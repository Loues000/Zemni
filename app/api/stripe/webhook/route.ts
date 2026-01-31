import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, getTierFromPriceId } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import Stripe from "stripe";
import { trackWebhookError, trackEvent } from "@/lib/error-tracking";

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
    const error = err instanceof Error ? err : new Error(String(err));
    trackWebhookError(error, "stripe", undefined, {
      action: "signature_verification",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerkUserId;
        const tier = session.metadata?.tier as "basic" | "plus" | "pro";

        if (!clerkUserId || !tier) {
          trackWebhookError(
            new Error("Missing metadata in checkout session"),
            "stripe",
            session,
            {
              action: "checkout_session_completed",
              metadata: {
                sessionId: session.id,
                clerkUserId,
                tier,
              },
            }
          );
          break;
        }

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Update user subscription using the correct mutation
        try {
          await convex.mutation(api.stripe.updateSubscriptionByClerkUserId, {
            clerkUserId,
            tier,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          });
        } catch (mutationError) {
          const error = mutationError instanceof Error ? mutationError : new Error(String(mutationError));
          trackWebhookError(error, "stripe", session, {
            userId: clerkUserId,
            userTier: tier,
            action: "checkout_session_completed",
            metadata: {
              customerId,
              subscriptionId,
            },
          });
          throw mutationError; // Re-throw to be caught by outer try-catch
        }

        trackEvent("subscription_created", {
          userId: clerkUserId,
          userTier: tier,
          metadata: {
            customerId,
            subscriptionId,
          },
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
          trackWebhookError(
            new Error("No price ID found in subscription"),
            "stripe",
            subscription,
            {
              action: "customer_subscription_created",
              metadata: {
                subscriptionId: subscription.id,
                customerId,
                itemsCount: subscription.items.data.length,
              },
            }
          );
          break;
        }

        const tier = getTierFromPriceId(priceId);
        if (!tier || tier === "free") {
          trackWebhookError(
            new Error("Invalid tier from price ID"),
            "stripe",
            subscription,
            {
              action: "customer_subscription_created",
              metadata: {
                priceId,
                tier,
                subscriptionId: subscription.id,
                customerId,
              },
            }
          );
          break;
        }

        // Update user subscription by customer ID
        try {
          await convex.mutation(api.stripe.updateSubscriptionByCustomerId, {
            stripeCustomerId: customerId,
            tier,
            stripeSubscriptionId: subscriptionId,
          });
        } catch (mutationError) {
          const error = mutationError instanceof Error ? mutationError : new Error(String(mutationError));
          trackWebhookError(error, "stripe", subscription, {
            userTier: tier,
            action: "customer_subscription_created",
            metadata: {
              customerId,
              subscriptionId,
            },
          });
          throw mutationError; // Re-throw to be caught by outer try-catch
        }

        trackEvent("subscription_created", {
          userTier: tier,
          metadata: {
            customerId,
            subscriptionId,
          },
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
          trackWebhookError(
            new Error("No price ID found in subscription"),
            "stripe",
            subscription,
            {
              action: "customer_subscription_updated",
              metadata: {
                subscriptionId: subscription.id,
                customerId,
                status: subscription.status,
                itemsCount: subscription.items.data.length,
              },
            }
          );
          break;
        }

        const tier = getTierFromPriceId(priceId);
        if (!tier || tier === "free") {
          trackWebhookError(
            new Error("Invalid tier from price ID"),
            "stripe",
            subscription,
            {
              action: "customer_subscription_updated",
              metadata: {
                priceId,
                tier,
                subscriptionId: subscription.id,
                customerId,
                status: subscription.status,
              },
            }
          );
          break;
        }

        // Only update if subscription is active
        try {
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
        } catch (mutationError) {
          const error = mutationError instanceof Error ? mutationError : new Error(String(mutationError));
          trackWebhookError(error, "stripe", subscription, {
            userTier: tier,
            action: "customer_subscription_updated",
            metadata: {
              customerId,
              subscriptionId,
              status: subscription.status,
            },
          });
          throw mutationError; // Re-throw to be caught by outer try-catch
        }

        trackEvent("subscription_updated", {
          userTier: tier,
          metadata: {
            customerId,
            subscriptionId,
            status: subscription.status,
          },
        });

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Set tier to free when subscription is deleted
        try {
          await convex.mutation(api.stripe.updateSubscriptionByCustomerId, {
            stripeCustomerId: customerId,
            tier: "free",
            stripeSubscriptionId: undefined,
          });
        } catch (mutationError) {
          const error = mutationError instanceof Error ? mutationError : new Error(String(mutationError));
          trackWebhookError(error, "stripe", subscription, {
            action: "customer_subscription_deleted",
            metadata: {
              customerId,
            },
          });
          throw mutationError; // Re-throw to be caught by outer try-catch
        }

        trackEvent("subscription_deleted", {
          metadata: {
            customerId,
          },
        });

        break;
      }

      default:
        trackEvent("webhook_unhandled_event", {
          metadata: {
            eventId: event.id,
            eventType: event.type,
          },
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    trackWebhookError(errorObj, "stripe", event, {
      action: "webhook_handler",
      metadata: {
        eventType: event?.type,
        eventId: event?.id,
      },
    });
    // In production, you might want to return 200 to prevent Stripe from retrying
    // if the error is non-recoverable, or 500 to trigger retries for transient errors
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
