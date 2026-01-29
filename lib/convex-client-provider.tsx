"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Get the key - this should be available on both server and client
  // since it's NEXT_PUBLIC_ prefixed
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // Check if we have a key (even if it might be invalid)
  const hasKey = clerkKey && typeof clerkKey === "string";
  
  // Check if it's a valid key (not a placeholder)
  const isValidKey = hasKey && 
    clerkKey.startsWith("pk_") && 
    !clerkKey.includes("YOUR_CLERK_PUBLISHABLE_KEY");
  
  if (!hasKey) {
    // No key at all - render without Clerk
    if (typeof window !== "undefined") {
      console.warn("Clerk publishable key not found. Some features may not work.");
    }
    return <>{children}</>;
  }
  
  if (!isValidKey) {
    // Key exists but is invalid/placeholder - still render ClerkProvider
    // so components don't throw errors, but Clerk will handle the invalid key
    if (typeof window !== "undefined") {
      console.warn("Clerk publishable key appears to be a placeholder. Clerk features may not work.");
    }
    // Still render ClerkProvider to prevent component errors
    // Clerk will show appropriate errors for invalid keys
    return (
      <ClerkProvider publishableKey={clerkKey}>
        {children}
      </ClerkProvider>
    );
  }
  
  // Valid key - render full setup with Convex integration
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
