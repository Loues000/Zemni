import { ConvexHttpClient } from "convex/browser";

/**
 * Get a new ConvexHttpClient instance for the current request.
 * 
 * IMPORTANT: This creates a new client per call to prevent race conditions
 * when multiple concurrent requests call setAuth() with different tokens.
 * Each request must have its own client instance to ensure authentication
 * isolation.
 * 
 * @returns A new ConvexHttpClient instance
 */
export function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }

  return new ConvexHttpClient(url);
}
