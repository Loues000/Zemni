import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";

/**
 * Get current user from Clerk and sync to Convex
 * Call this in API routes to ensure user exists in Convex
 */
export async function getOrCreateConvexUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // We need to get the email from Clerk
  // For now, we'll use the userId as email placeholder
  // In production, you'd fetch the full user object from Clerk
  const email = `${userId}@clerk.user`; // Placeholder

  // Call Convex mutation to get or create user
  // Note: This requires authentication token, which we'll handle differently
  // For now, return the clerkUserId and let the client handle the sync
  return {
    clerkUserId: userId,
    email,
  };
}

/**
 * Get Convex user ID from Clerk user ID
 * This should be called from authenticated client components
 */
export async function getConvexUserId(clerkUserId: string, email: string) {
  // This will be called from client-side with proper authentication
  // The actual sync happens in a client component on mount
  return { clerkUserId, email };
}
