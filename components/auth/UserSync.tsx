"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { setUserContext, clearUserContext, trackError } from "@/lib/error-tracking";

/**
 * Component to sync Clerk user to Convex on mount
 * Should be included in the root layout or main app component
 * Only rendered when Clerk is properly configured
 */
export function UserSync() {
  const { user, isLoaded } = useUser();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);
  const ensureCorrectTier = useMutation(api.users.ensureCorrectTier);
  const currentUser = useQuery(api.users.getCurrentUser);
  
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * Sync user to Convex with retry logic
   */
  const syncUser = useCallback(async () => {
    if (!user) return;
    
    setSyncStatus("syncing");
    setSyncError(null);
    
    try {
      // Create or get user
      await getOrCreateUser({
        clerkUserId: user.id,
        email: user.primaryEmailAddress?.emailAddress || `${user.id}@clerk.user`,
      });
      
      // Ensure correct tier (background fix)
      try {
        await ensureCorrectTier({});
      } catch (tierError) {
        // Non-critical error, log but don't fail sync
        console.warn("[UserSync] Tier check failed (non-critical):", tierError);
      }
      
      setSyncStatus("idle");
      setRetryCount(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to sync user";
      console.error("[UserSync] Failed to sync user to Convex:", error);
      setSyncError(errorMessage);
      setSyncStatus("error");
      
      // Track error for monitoring
      trackError(error instanceof Error ? error : new Error(errorMessage), {
        userId: user.id,
        action: "user_sync",
        metadata: { retryCount },
      });
      
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, delay);
      }
    }
  }, [user, getOrCreateUser, ensureCorrectTier, retryCount]);

  // Main sync effect
  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      // User logged out - clear context
      clearUserContext();
      setSyncStatus("idle");
      setSyncError(null);
      return;
    }

    // Trigger sync
    syncUser();
  }, [user, isLoaded, syncUser]);

  // Set Sentry context when user data is available
  useEffect(() => {
    if (!user) return;

    if (currentUser) {
      setUserContext(user.id, currentUser.subscriptionTier, {
        email: user.primaryEmailAddress?.emailAddress,
      });
    } else if (syncError) {
      setUserContext(user.id, undefined, {
        email: user.primaryEmailAddress?.emailAddress,
        syncStatus: "error",
      });
    } else {
      setUserContext(user.id, undefined, {
        email: user.primaryEmailAddress?.emailAddress,
        syncStatus: "syncing",
      });
    }
  }, [user, currentUser, syncStatus, syncError]);

  return null;
}
