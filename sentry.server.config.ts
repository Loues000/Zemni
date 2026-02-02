/**
 * Server-side Sentry configuration
 * 
 * This file initializes Sentry for server-side error tracking.
 * Captures errors from API routes, server components, and edge functions.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && dsn !== "YOUR_SENTRY_DSN") {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    
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
  console.warn("[Sentry] Server DSN not configured. Error tracking disabled.");
}
