"use client";

import { useAppState } from "@/hooks";

export function CustomizationTab() {
  const {
    theme,
    setTheme,
    defaultStructureHints,
    setDefaultStructureHints,
  } = useAppState();

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
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={`btn ${theme === "dark" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTheme("dark")}
            >
              Dark
            </button>
          </div>
          <p className="field-hint">Choose your preferred color scheme</p>
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
          <p className="field-hint">These are prefilled in the hints box when you create a new summary.</p>
        </div>
      </div>
    </section>
  );
}
