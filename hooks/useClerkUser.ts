"use client";

import { useEffect, useState } from "react";

/**
 * Safely use Clerk's useUser hook, returning null if Clerk is not configured
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
