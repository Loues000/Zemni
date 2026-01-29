"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Component to sync Clerk user to Convex on mount
 * Should be included in the root layout or main app component
 * Only rendered when Clerk is properly configured
 */
export function UserSync() {
  const { user, isLoaded } = useUser();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    // Sync user to Convex
    getOrCreateUser({
      clerkUserId: user.id,
      email: user.primaryEmailAddress?.emailAddress || `${user.id}@clerk.user`,
    }).catch((error) => {
      console.error("Failed to sync user to Convex:", error);
    });
  }, [user, isLoaded, getOrCreateUser]);

  return null;
}
