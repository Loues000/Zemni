"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/hooks";
import {
  DEFAULT_SUMMARY_STYLE_FLAGS,
  SUMMARY_STYLE_FLAG_OPTIONS,
  SUMMARY_STYLE_FLAGS_VERSION,
  encodeSummaryStyleFlags,
  getSummaryStyleFlagsState,
  type SummaryStyleFlagKey,
  type SummaryStyleFlagsState,
} from "@/lib/summary-style-flags";

/**
 * Customize theme, stats visibility, and default structure hints.
 */
export function CustomizationTab() {
  const {
    theme,
    setTheme,
    defaultStructureHints,
    setDefaultStructureHints,
  } = useAppState();
  
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateDefaultStructureHints = useMutation(api.users.updateDefaultStructureHints);
  const updateSummaryStyleFlags = useMutation(api.users.updateSummaryStyleFlags);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [styleSaving, setStyleSaving] = useState(false);
  const [styleMessage, setStyleMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showNerdStats, setShowNerdStats] = useState(false);
  const [summaryStyleFlags, setSummaryStyleFlags] = useState<SummaryStyleFlagsState>({
    ...DEFAULT_SUMMARY_STYLE_FLAGS,
  });

  // Load from Convex on mount
  useEffect(() => {
    if (currentUser?.defaultStructureHints !== undefined) {
      setDefaultStructureHints(currentUser.defaultStructureHints || "");
    }
    setSummaryStyleFlags(
      getSummaryStyleFlagsState(currentUser?.summaryStyleFlags, currentUser?.summaryStyleFlagsVersion)
    );
  }, [currentUser, setDefaultStructureHints]);

  // Load nerd stats preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("showNerdStats");
      setShowNerdStats(saved === "true");
    }
  }, []);

  /**
   * Save default structure hints to the user profile.
   */
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateDefaultStructureHints({ hints: defaultStructureHints });
      setMessage({ type: "success", text: "Default structure hints saved." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save hints",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSummaryStyleToggle = (key: SummaryStyleFlagKey, enabled: boolean) => {
    setSummaryStyleFlags((prev) => ({
      ...prev,
      [key]: enabled,
    }));
  };

  const handleSaveSummaryStyleFlags = async () => {
    setStyleSaving(true);
    setStyleMessage(null);
    try {
      await updateSummaryStyleFlags({
        flags: encodeSummaryStyleFlags(summaryStyleFlags),
        version: SUMMARY_STYLE_FLAGS_VERSION,
      });
      setStyleMessage({ type: "success", text: "Summary style flags saved." });
    } catch (error) {
      setStyleMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save summary style flags",
      });
    } finally {
      setStyleSaving(false);
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Customization</h2>
      </div>

      <div className="settings-card">
        <div className="field">
          <label className="field-label">Theme</label>
          <div className="settings-theme-toggle">
            <button
              type="button"
              className={`btn ${theme === "light" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                const newTheme = "light";
                setTheme(newTheme);
                // Immediately apply to DOM
                if (typeof window !== "undefined") {
                  document.documentElement.setAttribute("data-theme", newTheme);
                  window.localStorage.setItem("theme", newTheme);
                }
              }}
            >
              Light
            </button>
            <button
              type="button"
              className={`btn ${theme === "dark" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                const newTheme = "dark";
                setTheme(newTheme);
                // Immediately apply to DOM
                if (typeof window !== "undefined") {
                  document.documentElement.setAttribute("data-theme", newTheme);
                  window.localStorage.setItem("theme", newTheme);
                }
              }}
            >
              Dark
            </button>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label">Show Nerd Stats</label>
          <div className="settings-toggle">
            <input
              type="checkbox"
              id="show-nerd-stats"
              checked={showNerdStats}
              onChange={(e) => {
                const value = e.target.checked;
                setShowNerdStats(value);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("showNerdStats", String(value));
                }
              }}
            />
            <label htmlFor="show-nerd-stats">
              Show technical stats like tokens, tokens/sec, and duration after generation
            </label>
          </div>
          <p className="field-hint">
            Enable to see detailed OpenRouter statistics after each generation
          </p>
        </div>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label" htmlFor="settings-default-hints">
            Default Structure Hints
          </label>
          <textarea
            id="settings-default-hints"
            className="field-input settings-textarea"
            rows={6}
            value={defaultStructureHints}
            onChange={(e) => setDefaultStructureHints(e.target.value)}
            placeholder="e.g., Focus on key definitions, worked examples, and likely exam traps."
          />
          <p className="field-hint">
            These are prefilled in the hints box when you create a new summary. They help guide the structure and focus of your summaries.
            These hints are optional and complement the system-wide guidelines - they don't override them.
          </p>
          {message && (
            <div className={`settings-notice ${message.type}`} style={{ marginTop: "8px" }}>
              {message.text}
            </div>
          )}
          <div className="settings-row" style={{ marginTop: "12px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Hints"}
            </button>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label">Summary Style Flags</label>
          <p className="field-hint">
            Enable or disable summary style rules globally for your account. Tables and callouts remain standard by default.
          </p>
          <div className="settings-instructions">
            {SUMMARY_STYLE_FLAG_OPTIONS.map((flagOption) => (
              <label key={flagOption.key} className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={summaryStyleFlags[flagOption.key]}
                  onChange={(event) => handleSummaryStyleToggle(flagOption.key, event.target.checked)}
                  disabled={styleSaving}
                />
                <span>
                  <strong>{flagOption.label}:</strong> {flagOption.description}
                </span>
              </label>
            ))}
          </div>
          {styleMessage && (
            <div className={`settings-notice ${styleMessage.type}`} style={{ marginTop: "8px" }}>
              {styleMessage.text}
            </div>
          )}
          <div className="settings-row" style={{ marginTop: "12px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveSummaryStyleFlags}
              disabled={styleSaving}
            >
              {styleSaving ? "Saving..." : "Save Summary Style Flags"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
