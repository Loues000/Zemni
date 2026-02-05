/**
 * Error tracking utility
 * 
 * This module provides centralized error tracking using Sentry.
 * Falls back to console logging when Sentry is not configured.
 */
import * as Sentry from "@sentry/nextjs";

export interface ErrorContext {
  userId?: string;
  userTier?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  silent?: boolean; // If true, skip console logging (still sends to Sentry)
}

export interface EventContext {
  userId?: string;
  userTier?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Records an error to console (unless suppressed) and forwards it to Sentry with contextual data and tags.
 *
 * @param error - Error instance or error message to record
 * @param context - Optional contextual information; if `silent` is true console logging is skipped. `timestamp` defaults to the current time when omitted. `action` and `userTier` are attached as Sentry tags and default to `"unknown"` when not provided.
 */
export function trackError(error: Error | string, context?: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  const timestamp = context?.timestamp || new Date().toISOString();

  const logData = {
    level: "error" as const,
    message: errorMessage,
    stack: errorStack,
    context: {
      ...context,
      timestamp,
    },
  };

  // Log to console unless silent flag is set
  if (!context?.silent) {
    console.error("[Error Tracking]", logData);
  }

  // Send to Sentry if configured
  try {
    Sentry.captureException(error, {
      contexts: {
        custom: {
          ...context,
          timestamp,
        },
      },
      tags: {
        action: context?.action || "unknown",
        userTier: context?.userTier || "unknown",
      },
    });
  } catch (sentryError) {
    // Sentry not initialized or failed - already logged to console
    console.warn("[Error Tracking] Sentry capture failed:", sentryError);
  }
}

/**
 * Record a non-error user event by logging it and adding a Sentry breadcrumb.
 *
 * @param eventType - The event name or type (e.g., "subscription_upgrade", "api_key_saved")
 * @param context - Optional contextual fields to include with the event; if `timestamp` is omitted, the current time is used
 */
export function trackEvent(eventType: string, context?: Omit<EventContext, "eventType">): void {
  const timestamp = context?.timestamp || new Date().toISOString();

  const logData = {
    level: "info" as const,
    eventType,
    context: {
      ...context,
      timestamp,
    },
  };

  // Always log to console
  console.log("[Event Tracking]", logData);

  // Send to Sentry as breadcrumb/message
  try {
    Sentry.addBreadcrumb({
      category: "user-action",
      message: eventType,
      data: {
        ...context,
        timestamp,
      },
      level: "info",
    });
  } catch (sentryError) {
    // Sentry not initialized or failed - already logged to console
    console.warn("[Event Tracking] Sentry breadcrumb failed:", sentryError);
  }
}

/**
 * Records an error that occurred while handling a webhook and attaches webhook-specific context.
 *
 * @param error - The error object or message
 * @param webhookType - Webhook identifier (e.g., "polar", "notion") used to set the action
 * @param webhookData - The webhook payload; if provided it will be stringified and included in metadata
 * @param context - Optional additional context (e.g., userId, userTier, metadata, timestamp, silent)
 */
export function trackWebhookError(
  error: Error | string,
  webhookType: string,
  webhookData?: unknown,
  context?: ErrorContext
): void {
  trackError(error, {
    ...context,
    action: `webhook_${webhookType}`,
    metadata: {
      ...context?.metadata,
      webhookType,
      webhookData: webhookData ? JSON.stringify(webhookData) : undefined,
    },
  });
}

/**
 * Attach user information and tier to Sentry's current scope.
 *
 * Sets the Sentry user id, merges any provided `additionalContext` into the user object,
 * and sets a `user_tier` tag (defaults to `"unknown"` when not provided).
 *
 * @param userId - The user's unique identifier
 * @param userTier - The user's subscription tier (used for the `user_tier` tag)
 * @param additionalContext - Additional user properties to merge into the Sentry user object
 */
export function setUserContext(
  userId: string,
  userTier?: string,
  additionalContext?: Record<string, unknown>
): void {
  try {
    Sentry.setUser({
      id: userId,
      ...additionalContext,
    });
    
    Sentry.setTag("user_tier", userTier || "unknown");
  } catch (error) {
    console.warn("[Error Tracking] Failed to set user context:", error);
  }
}

/**
 * Remove the current user from Sentry's context and mark the user tier as "anonymous".
 *
 * Attempts to clear Sentry's user information and set the `user_tier` tag to `"anonymous"`.
 * If Sentry operations fail, a console warning is emitted.
 */
export function clearUserContext(): void {
  try {
    Sentry.setUser(null);
    Sentry.setTag("user_tier", "anonymous");
  } catch (error) {
    console.warn("[Error Tracking] Failed to clear user context:", error);
  }
}