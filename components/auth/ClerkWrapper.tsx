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
 * Render `children` when Clerk is configured and the component has mounted; otherwise render the provided `fallback` or `null`.
 *
 * @param children - Elements to render inside Clerk's `SignedIn` when signed in.
 * @param fallback - Element to render while waiting for client mount or when Clerk is not configured. If omitted, `null` is rendered in those cases.
 * @returns A `SignedIn` wrapper rendering `children` when Clerk is configured and mounted; otherwise `fallback` or `null`.
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
 * Renders Clerk's SignedOut wrapper when Clerk is configured and the component is mounted; otherwise renders the provided fallback or the children.
 *
 * @param children - Content to render inside the SignedOut wrapper or to display when Clerk is not configured
 * @param fallback - Optional content to display while waiting for client mount or when Clerk is not configured
 * @returns The children wrapped with Clerk's SignedOut when Clerk is configured and running on the client; otherwise the `fallback` if provided, or `children`
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
 * Renders a Clerk SignInButton when Clerk is configured and the component has mounted; otherwise renders a fallback or a disabled placeholder button.
 *
 * @param children - Content to be rendered inside the SignInButton.
 * @param fallback - Element to render while mounting or when Clerk is not configured. If omitted, a disabled button is shown.
 * @param props - Additional props forwarded to the underlying SignInButton.
 * @returns The SignInButton element when Clerk is configured and mounted, otherwise the provided `fallback` or a disabled placeholder button.
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
