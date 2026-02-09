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
