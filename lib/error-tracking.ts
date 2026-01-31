/**
 * Error tracking utility
 * 
 * This module provides a foundation for error tracking and monitoring.
 * Currently logs errors to console with structured format.
 * 
 * TODO: Integrate with error tracking service (e.g., Sentry, LogRocket)
 * when ready for production monitoring.
 */

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

  const logData = {
    level: "error",
    message: errorMessage,
    stack: errorStack,
    context: {
      ...context,
      timestamp: context?.timestamp || new Date().toISOString(),
    },
  };

  // Log to console with structured format
  console.error("[Error Tracking]", logData);

  // TODO: Send to error tracking service
  // Example for Sentry:
  // if (typeof window !== "undefined" && window.Sentry) {
  //   window.Sentry.captureException(error, {
  //     contexts: { custom: context },
  //   });
  // }
}

/**
 * Track an event (non-error)
 * 
 * @param eventType - Type of event (e.g., "subscription_upgrade", "api_key_saved")
 * @param context - Additional context about the event
 */
export function trackEvent(eventType: string, context?: Omit<EventContext, "eventType">): void {
  const logData = {
    level: "info",
    eventType,
    context: {
      ...context,
      timestamp: context?.timestamp || new Date().toISOString(),
    },
  };

  // Log to console with structured format
  console.log("[Event Tracking]", logData);

  // TODO: Send to analytics service
  // Example for analytics:
  // if (typeof window !== "undefined" && window.analytics) {
  //   window.analytics.track(eventType, context);
  // }
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
