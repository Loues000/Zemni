"use client";

import { useEffect, useState } from "react";

interface SaveStatusProps {
  isSaving: boolean;
  error: string | null;
  lastSavedAt: Date | null;
  pendingSaves: number;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Renders a compact save-status UI that reflects current saving state, errors, and last-saved time.
 *
 * Displays one of: an error state (with optional Retry and Dismiss actions), an active saving indicator
 * (adjusts text when saving multiple items), a transient "Saved" notice shown briefly after a successful save,
 * the last-saved timestamp as a human-friendly "Saved X ago" message, or a "Not saved yet" idle message.
 *
 * @param isSaving - True when a save operation is in progress
 * @param error - Save error message; if present the error state is shown
 * @param lastSavedAt - Timestamp of the most recent successful save, used for "Saved" and "Saved X ago" displays
 * @param pendingSaves - Number of items currently being saved; when greater than 1 the saving text includes the count
 * @param onRetry - Optional callback invoked when the user clicks the Retry action in the error state
 * @param onDismiss - Optional callback invoked when the user clicks the Dismiss action in the error state
 * @returns A React element representing the current save status UI
 */
export function SaveStatus({ 
  isSaving, 
  error, 
  lastSavedAt, 
  pendingSaves,
  onRetry,
  onDismiss 
}: SaveStatusProps) {
  const [showSaved, setShowSaved] = useState(false);

  // Show "Saved" notification briefly after saving completes
  useEffect(() => {
    if (!isSaving && lastSavedAt && !error) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, lastSavedAt, error]);

  // Error state - show retry option
  if (error) {
    return (
      <div className="save-status error">
        <span className="save-status-icon">⚠️</span>
        <span className="save-status-text">Save failed</span>
        {onRetry && (
          <button className="save-status-action" onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss && (
          <button className="save-status-dismiss" onClick={onDismiss}>
            ✕
          </button>
        )}
      </div>
    );
  }

  // Saving state
  if (isSaving) {
    return (
      <div className="save-status saving">
        <span className="save-status-spinner" />
        <span className="save-status-text">
          {pendingSaves > 1 ? `Saving ${pendingSaves} items...` : "Saving..."}
        </span>
      </div>
    );
  }

  // Just saved state
  if (showSaved && lastSavedAt) {
    return (
      <div className="save-status saved">
        <span className="save-status-icon">✓</span>
        <span className="save-status-text">Saved</span>
      </div>
    );
  }

  // Last saved info (subtle)
  if (lastSavedAt) {
    const timeAgo = getTimeAgo(lastSavedAt);
    return (
      <div className="save-status idle" title={`Last saved: ${lastSavedAt.toLocaleString()}`}>
        <span className="save-status-text">Saved {timeAgo}</span>
      </div>
    );
  }

  // No save yet
  return (
    <div className="save-status idle">
      <span className="save-status-text">Not saved yet</span>
    </div>
  );
}

/**
 * Produces a human-friendly relative time string for the given date.
 *
 * @param date - The past date to describe.
 * @returns `just now` if less than 10 seconds, `Xs ago` for seconds, `Xm ago` for minutes (less than 60), `Xh ago` for hours (less than 24), otherwise the locale date string.
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 10) return "just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}