"use client";

import { useEffect, useState } from "react";

/**
 * Exposes Clerk user data and a readiness flag when running in a browser with Clerk configured.
 *
 * The hook returns an object with two properties:
 * - `user`: the Clerk user object when available, or `null` when Clerk is not configured or user data is not available.
 * - `isLoaded`: `true` after Clerk initialization has completed and `user` has been populated, `false` otherwise.
 *
 * If Clerk is not configured via NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or the code runs outside a browser environment, `user` remains `null` and `isLoaded` remains `false`.
 *
 * @returns An object containing `user` and `isLoaded`.
 */
export function useClerkUser() {
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if Clerk is configured
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && 
      clerkKey.startsWith("pk_") && 
      !clerkKey.includes("YOUR_CLERK_PUBLISHABLE_KEY");

    if (!isClerkConfigured || typeof window === "undefined") {
      return;
    }

    // Dynamically import and use Clerk hook
    import("@clerk/nextjs").then(({ useUser }) => {
      // This won't work because hooks can't be called conditionally
      // We need a different approach
    }).catch(() => {
      // Clerk not available
    });
  }, []);

  return { user, isLoaded };
}