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
}

export interface EventContext {
  userId?: string;
  userTier?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Track an error with context
 * 
 * @param error - The error object or message
 * @param context - Additional context about the error
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

  // Always log to console
  console.error("[Error Tracking]", logData);

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
 * Track an event (non-error)
 * 
 * @param eventType - Type of event (e.g., "subscription_upgrade", "api_key_saved")
 * @param context - Additional context about the event
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
 * Track a webhook error with detailed context
 * 
 * @param error - The error object or message
 * @param webhookType - Type of webhook (e.g., "stripe", "notion")
 * @param webhookData - The webhook payload
 * @param context - Additional context
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
 * Set user context for Sentry
 * Useful for associating errors with specific users
 * 
 * @param userId - The user's ID
 * @param userTier - The user's subscription tier
 * @param additionalContext - Any additional user context
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
 * Clear user context from Sentry
 * Call this on logout
 */
export function clearUserContext(): void {
  try {
    Sentry.setUser(null);
    Sentry.setTag("user_tier", "anonymous");
  } catch (error) {
    console.warn("[Error Tracking] Failed to clear user context:", error);
  }
}
