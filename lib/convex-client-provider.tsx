"use client";

import { ReactNode, useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  
  // Create Convex client inside component to ensure proper initialization
  const convex = useMemo(() => {
    if (!convexUrl) {
      console.error('[Convex] ERROR: NEXT_PUBLIC_CONVEX_URL is not set!');
      return null;
    }
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);
  
  const hasKey = clerkKey && typeof clerkKey === "string";
  const isValidKey = hasKey && 
    clerkKey.startsWith("pk_") && 
    !clerkKey.includes("YOUR_CLERK_PUBLISHABLE_KEY");
  
  if (!convexUrl || !convex) {
    console.error('[Convex] Cannot render - missing Convex URL');
    return <>{children}</>;
  }
  
  if (!hasKey) {
    if (typeof window !== "undefined") {
      console.warn("Clerk publishable key not found. Some features may not work.");
    }
    return <>{children}</>;
  }
  
  if (!isValidKey) {
    if (typeof window !== "undefined") {
      console.warn("Clerk publishable key appears to be a placeholder. Clerk features may not work.");
    }
    return (
      <ClerkProvider publishableKey={clerkKey}>
        {children}
      </ClerkProvider>
    );
  }
  
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
