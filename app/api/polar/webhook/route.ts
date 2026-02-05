import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { getTierFromProductId } from "@/lib/polar";
import { trackWebhookError, trackEvent } from "@/lib/error-tracking";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type SubscriptionPayload = Record<string, any>;

/**
 * Return the first non-empty string from the provided values.
 *
 * @param values - Values to inspect for a non-empty string
 * @returns The first value that is a string containing at least one non-whitespace character, or `undefined` if none found.
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
 * Normalize a numeric timestamp to milliseconds.
 *
 * @param value - Timestamp in seconds or milliseconds; values less than 1_000_000_000_000 are treated as seconds and converted to milliseconds
 * @returns The timestamp expressed in milliseconds, or `undefined` if `value` is not a number
 */
function normalizeTimestamp(value?: number): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

/**
 * Converts a Date, numeric timestamp, or timestamp string into milliseconds since the UNIX epoch.
 *
 * @param value - A Date, a number (seconds or milliseconds), or a parsable date string.
 * @returns The timestamp in milliseconds, or `undefined` if `value` is missing or cannot be parsed.
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
 * Extracts a subscription start timestamp from known timestamp fields on a subscription payload.
 *
 * Checks `startedAt`, `started_at`, `createdAt`, `created_at`, `currentPeriodStart`, and `current_period_start` (in that order) and returns the first valid date converted to a numeric timestamp in milliseconds.
 *
 * @param subscription - The subscription payload to inspect
 * @returns The start timestamp in milliseconds if a valid date is found, `undefined` otherwise
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
 * Extracts a product identifier from a Polar subscription payload.
 *
 * @param subscription - The subscription payload that may contain product identifiers in several possible fields/shapes
 * @returns The first non-empty product id found, or `undefined` if none is present
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
 * Extracts the customer identifier from a Polar subscription payload.
 *
 * @param subscription - The subscription payload to read identifiers from.
 * @returns The first non-empty customer id found in known fields, or `undefined` if none are present.
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
 * Extracts an external customer identifier from a subscription payload.
 *
 * Checks common field names used for external or Clerk customer IDs and returns the first non-empty string found.
 *
 * @param subscription - The subscription payload to search for an external customer identifier
 * @returns The first non-empty external customer ID found, or `undefined` if none are present
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
 * Handles Polar webhook POST requests: verifies the signature, parses subscription events, updates user subscription state in Convex, and records telemetry.
 *
 * Processes only events whose type begins with "subscription."; ignored or malformed payloads return a harmless acknowledgement. On valid subscription events the handler extracts identifiers (product, customer, external user, subscription id, start date), determines active vs. inactive state, updates the user's tier via Convex mutations (by external user id or Polar customer id), and tracks update/downgrade events or errors.
 *
 * @returns A JSON NextResponse describing the result: on success or ignored payloads `{ received: true }`; on invalid signature a 403 response with `{ error: "Invalid signature" }`; on webhook verification failure a 400 response with `{ error: "Webhook verification failed" }`; on internal errors a 500 response with `{ error: "Webhook handler failed" }`.
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