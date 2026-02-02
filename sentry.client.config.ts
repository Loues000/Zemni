/**
 * Client-side Sentry configuration
 * 
 * This file initializes Sentry for browser error tracking.
 * Automatically captures unhandled exceptions and performance data.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && dsn !== "YOUR_SENTRY_DSN") {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    
    // Session Replay (optional, for debugging user interactions)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Don't send PII by default
    sendDefaultPii: false,
    
    beforeSend(event) {
      // Sanitize sensitive data before sending
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
} else {
  console.warn("[Sentry] Client DSN not configured. Error tracking disabled.");
}
