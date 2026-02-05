import * as Sentry from "@sentry/nextjs";

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
