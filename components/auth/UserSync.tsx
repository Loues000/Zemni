"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { setUserContext, clearUserContext } from "@/lib/error-tracking";

/**
 * Component to sync Clerk user to Convex on mount
 * Should be included in the root layout or main app component
 * Only rendered when Clerk is properly configured
 */
export function UserSync() {
  const { user, isLoaded } = useUser();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);
  const currentUser = useQuery(api.users.getCurrentUser);

  useEffect(() => {
    if (!isLoaded || !user) {
      // User logged out - clear Sentry context
      clearUserContext();
      return;
    }

    // Sync user to Convex
    getOrCreateUser({
      clerkUserId: user.id,
      email: user.primaryEmailAddress?.emailAddress || `${user.id}@clerk.user`,
    }).catch((error) => {
      console.error("Failed to sync user to Convex:", error);
    });

    // Set Sentry user context for error tracking
    if (currentUser) {
      setUserContext(user.id, currentUser.subscriptionTier, {
        email: user.primaryEmailAddress?.emailAddress,
      });
    } else {
      // User exists but data not loaded yet - set basic context
      setUserContext(user.id, undefined, {
        email: user.primaryEmailAddress?.emailAddress,
      });
    }
  }, [user, isLoaded, getOrCreateUser, currentUser]);

  return null;
}
