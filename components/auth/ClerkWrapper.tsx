"use client";

import { ReactNode, useState, useEffect } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

/**
 * Check if Clerk is properly configured at module level
 */
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const IS_CLERK_CONFIGURED = !!(
  CLERK_KEY && 
  CLERK_KEY.startsWith("pk_") && 
  !CLERK_KEY.includes("YOUR_CLERK_PUBLISHABLE_KEY")
);

interface ClerkWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wrapper for SignedIn that handles non-configured Clerk gracefully
 */
export function ClerkSignedIn({ children, fallback }: ClerkWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{fallback || null}</>;
  }

  if (!IS_CLERK_CONFIGURED) {
    return <>{fallback || null}</>;
  }

  return <SignedIn>{children}</SignedIn>;
}

/**
 * Wrapper for SignedOut that handles non-configured Clerk gracefully
 */
export function ClerkSignedOut({ children, fallback }: ClerkWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{fallback || children}</>;
  }

  if (!IS_CLERK_CONFIGURED) {
    // If Clerk is not configured, we treat the user as "signed out"
    // but without the ability to sign in via Clerk
    return <>{fallback || children}</>;
  }

  return <SignedOut>{children}</SignedOut>;
}

/**
 * Wrapper for SignInButton that handles non-configured Clerk gracefully
 */
export function ClerkSignInButton({ children, fallback, ...props }: any) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{fallback || <button disabled className="btn btn-secondary">Loading...</button>}</>;
  }

  if (!IS_CLERK_CONFIGURED) {
    return <>{fallback || <button disabled className="btn btn-secondary">Sign In (Not Configured)</button>}</>;
  }

  return <SignInButton {...props}>{children}</SignInButton>;
}

