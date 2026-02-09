"use client";

import { useState, useEffect } from "react";
import { ClerkSignedOut, ClerkSignInButton } from "@/components/auth/ClerkWrapper";
import { IconX } from "@/components/ui";

const STORAGE_KEY = "login-prompt-dismissed";

interface LoginPromptBannerProps {
  onDismiss?: () => void;
}

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
