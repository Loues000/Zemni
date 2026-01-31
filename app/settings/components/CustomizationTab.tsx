"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/hooks";

export function CustomizationTab() {
  const {
    theme,
    setTheme,
    defaultStructureHints,
    setDefaultStructureHints,
  } = useAppState();
  
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateDefaultStructureHints = useMutation(api.users.updateDefaultStructureHints);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showNerdStats, setShowNerdStats] = useState(false);

  // Load from Convex on mount
  useEffect(() => {
    if (currentUser?.defaultStructureHints !== undefined) {
      setDefaultStructureHints(currentUser.defaultStructureHints || "");
    }
  }, [currentUser, setDefaultStructureHints]);

  // Load nerd stats preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("showNerdStats");
      setShowNerdStats(saved === "true");
    }
  }, []);

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

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Customization</h2>
        <p>Customize your UI preferences and defaults</p>
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
          <p className="field-hint">Choose your preferred color scheme</p>
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
      </div>
    </section>
  );
}
