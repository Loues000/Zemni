"use client";

import { useState, useEffect } from "react";
import { ClerkSignedOut, ClerkSignInButton } from "@/components/auth/ClerkWrapper";
import { IconX } from "@/components/ui";

const STORAGE_KEY = "login-prompt-dismissed";

interface LoginPromptBannerProps {
  onDismiss?: () => void;
}

/**
 * Displays a dismissible sign-up prompt for unauthenticated users and persists dismissal in localStorage.
 *
 * Shows a "Sign Up Free" button that opens Clerk's sign-in modal when rendered; the banner is rendered only after client mount and when not previously dismissed.
 *
 * @param onDismiss - Optional callback invoked after the banner is dismissed.
 * @returns The banner element when visible, or `null` if hidden or before client mount.
 */
export function LoginPromptBanner({ onDismiss }: LoginPromptBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user has dismissed it before
    if (typeof window !== "undefined") {
      const dismissed = window.localStorage.getItem(STORAGE_KEY) === "true";
      setIsDismissed(dismissed);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    onDismiss?.();
  };

  if (!mounted || isDismissed) {
    return null;
  }

  return (
    <ClerkSignedOut>
      <div className="login-prompt-banner">
        <div className="login-prompt-content">
          <span className="login-prompt-text">
            Create a free account to save your work permanently and access it from any device
          </span>
          <ClerkSignInButton mode="modal">
            <button type="button" className="btn btn-primary btn-sm">
              Sign Up Free
            </button>
          </ClerkSignInButton>
        </div>
        <button
          type="button"
          className="login-prompt-close"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <IconX />
        </button>
      </div>
    </ClerkSignedOut>
  );
}