"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { exportHistoryAsZip } from "@/lib/export-history-zip";
import { isHistoryEntry, sortHistory } from "@/lib/history-storage";
import { useAppState, useHistory } from "@/hooks";
import { ModelSelector } from "@/components/ui";

type SettingsNotice = { kind: "success" | "error"; message: string } | null;

const SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "customization", label: "Customization" },
  { id: "history", label: "History & Export" }
] as const;

/**
 * Legacy settings page for local device preferences.
 */
export function SettingsPage(): JSX.Element {
  const {
    theme,
    setTheme,
    models,
    selectedModel,
    setSelectedModel,
    defaultModel,
    defaultStructureHints,
    setDefaultModel,
    setDefaultStructureHints
  } = useAppState();
  const { history, updateHistoryState } = useHistory();

  const [localDefaultModel, setLocalDefaultModel] = useState<string>(defaultModel);
  const [localDefaultStructureHints, setLocalDefaultStructureHints] = useState<string>(defaultStructureHints);
  const [notice, setNotice] = useState<SettingsNotice>(null);
  const [activeTab, setActiveTab] = useState<string>(SETTINGS_TABS[0].id);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalDefaultModel(defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    setLocalDefaultStructureHints(defaultStructureHints);
  }, [defaultStructureHints]);

  const modelOptions = useMemo(() => {
    return models.map((model) => ({ id: model.id, label: model.displayName }));
  }, [models]);

  const resolvedDefaultModel = localDefaultModel || defaultModel || selectedModel || modelOptions[0]?.id || "";

  const handleSaveDefaults = useCallback(() => {
    if (!resolvedDefaultModel) {
      setNotice({ kind: "error", message: "No models available yet. Please try again shortly." });
      return;
    }

    setDefaultModel(resolvedDefaultModel);
    setDefaultStructureHints(localDefaultStructureHints);
    setSelectedModel(resolvedDefaultModel);
    setNotice({ kind: "success", message: "Defaults saved locally on this device." });
  }, [
    resolvedDefaultModel,
    localDefaultStructureHints,
    setDefaultModel,
    setDefaultStructureHints,
    setSelectedModel
  ]);

  const handleExportJson = useCallback(() => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        entries: history
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zemni-history-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice({ kind: "success", message: "History exported as JSON." });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Failed to export history." });
    }
  }, [history]);

  const handleExportZip = useCallback(async () => {
    try {
      await exportHistoryAsZip(history);
      setNotice({ kind: "success", message: "History exported as ZIP." });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Failed to export ZIP." });
    }
  }, [history]);

  const mergeImportedHistory = useCallback((importedEntries: unknown[]) => {
    const validEntries = importedEntries.filter(isHistoryEntry);
    if (validEntries.length === 0) {
      setNotice({ kind: "error", message: "No valid history entries found in that file." });
      return;
    }

    updateHistoryState((prev) => {
      const nextById = new Map<string, (typeof validEntries)[number]>();
      for (const entry of prev) {
        nextById.set(entry.id, entry);
      }
      for (const entry of validEntries) {
        const existing = nextById.get(entry.id);
        if (!existing || entry.updatedAt >= existing.updatedAt) {
          nextById.set(entry.id, entry);
        }
      }
      return sortHistory(Array.from(nextById.values()));
    });

    setNotice({
      kind: "success",
      message: `Imported ${validEntries.length} history ${validEntries.length === 1 ? "entry" : "entries"}.`
    });
  }, [updateHistoryState]);

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { entries?: unknown[] } | unknown[];
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!entries || !Array.isArray(entries)) {
        setNotice({ kind: "error", message: "That file does not look like a history export." });
        return;
      }
      mergeImportedHistory(entries);
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Failed to import history." });
    }
  }, [mergeImportedHistory]);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImportChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleImportFile(file);
    }
    e.target.value = "";
  }, [handleImportFile]);

  const historyStats = useMemo(() => {
    const outputsCount = history.reduce((acc, entry) => acc + Object.keys(entry.outputs ?? {}).length, 0);
    const lastUpdated = history[0]?.updatedAt ?? null;
    return { entries: history.length, outputs: outputsCount, lastUpdated };
  }, [history]);

  const scrollToTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
    const el = document.getElementById(`settings-${tabId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <aside className="settings-sidebar">
          <Link href="/" className="settings-back-link">
            ← Back to Zemni
          </Link>
          <div className="settings-sidebar-card">
            <div className="settings-avatar">Z</div>
            <div className="settings-sidebar-title">Device Preferences</div>
            <div className="settings-sidebar-subtitle">Saved locally in your browser</div>
            <div className="settings-sidebar-divider" />
            <div className="settings-metric">
              <span>History entries</span>
              <strong>{historyStats.entries}</strong>
            </div>
            <div className="settings-metric">
              <span>Generated outputs</span>
              <strong>{historyStats.outputs}</strong>
            </div>
            <div className="settings-metric">
              <span>Last activity</span>
              <strong>
                {historyStats.lastUpdated ? new Date(historyStats.lastUpdated).toLocaleString() : "No history yet"}
              </strong>
            </div>
          </div>
        </aside>

        <main className="settings-main">
          <header className="settings-header">
            <div>
              <h1 className="settings-title">Settings</h1>
              <p className="settings-subtitle">
                Shape defaults, keep your custom inputs, and manage exports. AI keys come later.
              </p>
            </div>
            <div className="settings-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                Theme: {theme === "dark" ? "Dark" : "Light"}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveDefaults}>
                Save Defaults
              </button>
            </div>
          </header>

          <nav className="settings-tabs" aria-label="Settings sections">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`settings-tab${activeTab === tab.id ? " active" : ""}`}
                onClick={() => scrollToTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {notice && (
            <div className={`settings-notice ${notice.kind}`}>
              {notice.message}
            </div>
          )}

          <section id="settings-general" className="settings-section">
            <div className="settings-section-header">
              <h2>General</h2>
              <p>Choose what Zemni should preselect when you start working.</p>
            </div>
            <div className="settings-card">
              <div className="field">
                <label className="field-label" htmlFor="settings-default-model">
                  Default model
                </label>
                <ModelSelector
                  id="settings-default-model"
                  models={models}
                  selectedModel={resolvedDefaultModel}
                  onModelChange={setLocalDefaultModel}
                />
                <p className="field-hint">This becomes the default selection on the main screen.</p>
              </div>
            </div>
          </section>

          <section id="settings-customization" className="settings-section">
            <div className="settings-section-header">
              <h2>Customization</h2>
              <p>Keep reusable hints so you do not need to rewrite them every time.</p>
            </div>
            <div className="settings-card">
              <div className="field">
                <label className="field-label" htmlFor="settings-default-hints">
                  Default structure hints
                </label>
                <textarea
                  id="settings-default-hints"
                  className="field-input settings-textarea"
                  rows={6}
                  value={localDefaultStructureHints}
                  onChange={(e) => setLocalDefaultStructureHints(e.target.value)}
                  placeholder="e.g., Focus on key definitions, worked examples, and likely exam traps."
                />
                <p className="field-hint">These are prefilled in the hints box when you create a new summary.</p>
              </div>
            </div>
          </section>

          <section id="settings-history" className="settings-section">
            <div className="settings-section-header">
              <h2>History & Export</h2>
              <p>Back up or transfer your locally stored history without accounts.</p>
            </div>
            <div className="settings-card settings-card-split">
              <div className="settings-card-block">
                <div className="settings-card-title">Backups</div>
                <p className="settings-card-copy">
                  Export your history for safekeeping. JSON is lightweight; ZIP includes multiple formats per output.
                </p>
                <div className="settings-row">
                  <button type="button" className="btn btn-secondary" onClick={handleExportJson} disabled={history.length === 0}>
                    Export JSON
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleExportZip} disabled={history.length === 0}>
                    Export ZIP
                  </button>
                </div>
                {history.length === 0 && (
                  <p className="field-hint">No history yet. Generate something first and it will show up here.</p>
                )}
              </div>

              <div className="settings-card-block">
                <div className="settings-card-title">Import</div>
                <p className="settings-card-copy">
                  Merge another export into this device. When IDs collide, the newest entry wins.
                </p>
                <div className="settings-row">
                  <button type="button" className="btn btn-secondary" onClick={onImportClick}>
                    Import JSON
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="settings-hidden-input"
                  onChange={onImportChange}
                />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
