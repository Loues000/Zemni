import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { getTierFromProductId } from "@/lib/polar";
import { trackWebhookError, trackEvent } from "@/lib/error-tracking";
import { getConvexClient } from "@/lib/convex-server";

type SubscriptionPayload = Record<string, any>;

/**
 * Return the first non-empty string from a list of values.
 */
function firstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

/**
 * Normalize timestamps to milliseconds when provided in seconds.
 */
function normalizeTimestamp(value?: number): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

/**
 * Parse a date-like value into a millisecond timestamp.
 */
function parseDate(value?: unknown): number | undefined {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return normalizeTimestamp(value);
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : ms;
  }
  return undefined;
}

/**
 * Resolve the subscription start date from payload variants.
 */
function getSubscriptionStartDate(subscription: SubscriptionPayload): number | undefined {
  return (
    parseDate(subscription.startedAt) ??
    parseDate(subscription.started_at) ??
    parseDate(subscription.createdAt) ??
    parseDate(subscription.created_at) ??
    parseDate(subscription.currentPeriodStart) ??
    parseDate(subscription.current_period_start)
  );
}

/**
 * Extract a product identifier from multiple payload shapes.
 */
function getProductId(subscription: SubscriptionPayload): string | undefined {
  return firstString(
    subscription.productId,
    subscription.product_id,
    subscription.product?.id,
    subscription.product?.productId,
    subscription.product?.product_id,
    subscription.products?.[0]?.id,
    subscription.products?.[0]?.productId,
    subscription.products?.[0]?.product_id
  );
}

/**
 * Extract the Polar customer id from payload variants.
 */
function getCustomerId(subscription: SubscriptionPayload): string | undefined {
  return firstString(
    subscription.customerId,
    subscription.customer_id,
    subscription.customer?.id,
    subscription.customer?.customer_id
  );
}

/**
 * Extract the external customer id (Clerk user id) from payload variants.
 */
function getExternalCustomerId(subscription: SubscriptionPayload): string | undefined {
  return firstString(
    subscription.externalCustomerId,
    subscription.external_customer_id,
    subscription.customer?.externalId,
    subscription.customer?.external_id,
    subscription.metadata?.clerkUserId,
    subscription.metadata?.clerk_user_id
  );
}

/**
 * Handle Polar subscription webhooks and sync tiers to Convex.
 */
export async function POST(request: Request) {
  const bodyBuffer = Buffer.from(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers);

  let event: any;

  try {
    event = validateEvent(bodyBuffer, headers, process.env.POLAR_WEBHOOK_SECRET!);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    trackWebhookError(error, "polar", undefined, { action: "signature_verification" });
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  try {
    const convex = getConvexClient();
    const subscription = (event?.data?.subscription ?? event?.data) as SubscriptionPayload;
    const eventType = event?.type as string | undefined;

    if (!subscription || !eventType) {
      trackWebhookError(
        new Error("Webhook payload missing subscription data"),
        "polar",
        event,
        { action: "missing_payload" }
      );
      return NextResponse.json({ received: true });
    }

    if (!eventType.startsWith("subscription.")) {
      trackEvent("webhook_unhandled_event", {
        metadata: {
          eventType,
          eventId: event?.id,
        },
      });
      return NextResponse.json({ received: true });
    }

    const productId = getProductId(subscription);
    const polarCustomerId = getCustomerId(subscription);
    const clerkUserId = getExternalCustomerId(subscription);
    const polarSubscriptionId = firstString(subscription.id);
    const subscriptionStartDate = getSubscriptionStartDate(subscription);

    const status = firstString(subscription.status)?.toLowerCase();
    const eventIndicatesActive = [
      "subscription.created",
      "subscription.updated",
      "subscription.uncanceled",
      "subscription.active",
    ].includes(eventType);
    const isActive = status ? status === "active" || status === "trialing" : eventIndicatesActive;

    /**
     * Update a subscription by Clerk user id when available.
     */
    const updateByClerkUserId = async (payload: {
      tier: "free" | "basic" | "plus" | "pro";
      polarCustomerId?: string;
      polarSubscriptionId?: string;
      subscriptionStartDate?: number;
    }) => {
      if (!clerkUserId) {
        return false;
      }
      await convex.mutation(api.polar.updateSubscriptionByClerkUserId, {
        clerkUserId,
        ...payload,
      });
      return true;
    };

    /**
     * Update a subscription by Polar customer id when available.
     */
    const updateByCustomerId = async (payload: {
      tier: "free" | "basic" | "plus" | "pro";
      polarSubscriptionId?: string;
      subscriptionStartDate?: number;
    }) => {
      if (!polarCustomerId) {
        return false;
      }
      await convex.mutation(api.polar.updateSubscriptionByCustomerId, {
        polarCustomerId,
        ...payload,
      });
      return true;
    };

    if (isActive) {
      if (!productId) {
        trackWebhookError(
          new Error("Missing product ID in subscription payload"),
          "polar",
          subscription,
          { action: eventType }
        );
        return NextResponse.json({ received: true });
      }

      const tier = getTierFromProductId(productId);
      if (!tier) {
        trackWebhookError(
          new Error("Invalid or unknown product ID - tier could not be determined"),
          "polar",
          subscription,
          { action: eventType, metadata: { productId } }
        );
        return NextResponse.json({ received: true });
      }

      const activePayload = {
        tier,
        ...(polarCustomerId ? { polarCustomerId } : {}),
        ...(polarSubscriptionId ? { polarSubscriptionId } : {}),
        ...(subscriptionStartDate !== undefined ? { subscriptionStartDate } : {}),
      };

      const updated =
        (await updateByClerkUserId(activePayload)) ||
        (await updateByCustomerId({
          tier,
          ...(polarSubscriptionId ? { polarSubscriptionId } : {}),
          ...(subscriptionStartDate !== undefined ? { subscriptionStartDate } : {}),
        }));

      if (!updated) {
        trackWebhookError(
          new Error("No user identifier found for subscription update"),
          "polar",
          subscription,
          { action: eventType }
        );
        return NextResponse.json({ received: true });
      }

      trackEvent("subscription_updated", {
        userId: clerkUserId,
        userTier: tier,
        metadata: {
          polarCustomerId,
          polarSubscriptionId,
          eventType,
        },
      });
    } else {
      const downgradePayload = {
        tier: "basic" as const,
        ...(polarCustomerId ? { polarCustomerId } : {}),
        polarSubscriptionId: undefined,
      };

      const updated =
        (await updateByClerkUserId(downgradePayload)) ||
        (await updateByCustomerId({
          tier: "basic",
          polarSubscriptionId: undefined,
        }));

      if (!updated) {
        trackWebhookError(
          new Error("No user identifier found for subscription downgrade"),
          "polar",
          subscription,
          { action: eventType }
        );
        return NextResponse.json({ received: true });
      }

      trackEvent("subscription_downgraded", {
        userId: clerkUserId,
        metadata: {
          polarCustomerId,
          polarSubscriptionId,
          eventType,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    trackWebhookError(errorObj, "polar", event, {
      action: "webhook_handler",
      metadata: {
        eventType: event?.type,
        eventId: event?.id,
      },
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
