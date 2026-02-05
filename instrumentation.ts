import * as Sentry from "@sentry/nextjs";

/**
 * Loads Sentry configuration appropriate for the current Next.js runtime.
 *
 * When `process.env.NEXT_RUNTIME` equals `"nodejs"`, the server Sentry configuration
 * is imported; when it equals `"edge"`, the edge Sentry configuration is imported.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // @ts-ignore - Dynamic import for Sentry server config
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // @ts-ignore - Dynamic import for Sentry edge config
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;