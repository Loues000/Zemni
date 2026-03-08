"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { exportHistoryAsZip } from "@/lib/export-history-zip";

export function HistorySyncTab() {
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState<"export-json" | "export-zip" | "import" | "delete" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documents = useQuery(api.documents.list, { limit: 100 });
  const deleteDoc = useMutation(api.documents.remove);
  const upsertDoc = useMutation(api.documents.upsert);
  const loading = busyAction !== null;

  const handleExportJson = useCallback(() => {
    if (!documents?.documents) return;

    try {
      setBusyAction("export-json");
      setMessage({ type: "info", text: "Preparing JSON export..." });
      const payload = {
        exportedAt: new Date().toISOString(),
        entries: documents.documents.map((doc: any) => ({
          id: doc._id,
          title: doc.title,
          fileName: doc.fileName,
          extractedText: doc.extractedText,
          outputs: doc.outputs,
          structureHints: doc.structureHints,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          exportedSubject: doc.exportedSubject,
          notionPageId: doc.notionPageId,
        })),
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
      setMessage({ type: "success", text: `JSON export ready with ${documents.documents.length} document(s).` });
    } catch (err) {
      console.error("Failed to export:", err);
      setMessage({ type: "error", text: "Failed to export JSON history." });
    } finally {
      setBusyAction(null);
    }
  }, [documents]);

  const handleExportZip = useCallback(async () => {
    if (!documents?.documents) return;

    try {
      setBusyAction("export-zip");
      setMessage({ type: "info", text: "Preparing ZIP export..." });
      const historyEntries = documents.documents.map((doc: any) => ({
        id: doc._id,
        title: doc.title,
        fileName: doc.fileName,
        extractedText: doc.extractedText,
        outputs: doc.outputs,
        structureHints: doc.structureHints,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        exportedSubject: doc.exportedSubject,
        notionPageId: doc.notionPageId,
      }));
      await exportHistoryAsZip(historyEntries as any);
      setMessage({ type: "success", text: `ZIP export ready with ${historyEntries.length} document(s).` });
    } catch (err) {
      console.error("Failed to export ZIP:", err);
      setMessage({ type: "error", text: "Failed to export ZIP history." });
    } finally {
      setBusyAction(null);
    }
  }, [documents]);

  const handleImport = useCallback(async (file: File) => {
    setBusyAction("import");
    setMessage({ type: "info", text: `Importing ${file.name}...` });

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { entries?: unknown[] } | unknown[];
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;

      if (!entries || !Array.isArray(entries)) {
        setMessage({ type: "error", text: "Invalid import file format." });
        return;
      }

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (const entry of entries) {
        try {
          if (!entry || typeof entry !== "object") {
            errors++;
            continue;
          }

          const entryObj = entry as Record<string, unknown>;
          const title = String(entryObj.title ?? "Imported Document");
          const fileName = String(entryObj.fileName ?? "imported.txt");
          const extractedText = String(entryObj.extractedText ?? "");
          const outputs = entryObj.outputs ?? {};
          const structureHints = String(entryObj.structureHints ?? "");
          const exportedSubject =
            typeof entryObj.exportedSubject === "string" ? entryObj.exportedSubject : undefined;
          const notionPageId =
            typeof entryObj.notionPageId === "string" ? entryObj.notionPageId : undefined;

          if (!extractedText.trim()) {
            skipped++;
            continue;
          }

          await upsertDoc({
            title,
            fileName,
            extractedText,
            outputs,
            structureHints,
            exportedSubject,
            notionPageId,
          });

          imported++;
        } catch (err) {
          console.error("Failed to import entry:", err);
          errors++;
        }
      }

      const summary = `Imported ${imported} document(s)${
        skipped > 0 ? `, skipped ${skipped}` : ""
      }${errors > 0 ? `, ${errors} errors` : ""}`;
      setMessage({ type: errors > 0 ? "error" : "success", text: summary });
    } catch (err) {
      console.error("Failed to import:", err);
      setMessage({ type: "error", text: "Failed to import history. Please check the file format." });
    } finally {
      setBusyAction(null);
    }
  }, [upsertDoc]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedDocs.size === 0) return;
    if (!confirm(`Delete ${selectedDocs.size} document(s)?`)) return;

    setBusyAction("delete");
    setMessage({ type: "info", text: `Deleting ${selectedDocs.size} document(s)...` });

    try {
      for (const docId of selectedDocs) {
        await deleteDoc({ documentId: docId as any });
      }
      setSelectedDocs(new Set());
      setMessage({ type: "success", text: `Deleted ${selectedDocs.size} document(s).` });
    } catch (err) {
      console.error("Failed to delete:", err);
      setMessage({ type: "error", text: "Failed to delete selected history entries." });
    } finally {
      setBusyAction(null);
    }
  }, [selectedDocs, deleteDoc]);

  const toggleSelect = (docId: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>History & Sync</h2>
      </div>

      <div className="settings-card">
        {message && (
          <div className={`settings-notice ${message.type}`} style={{ marginBottom: "12px" }}>
            {message.text}
          </div>
        )}
        <div className="settings-card-split">
          <div className="settings-card-block">
            <div className="settings-card-title">Export</div>
            <p className="settings-card-copy">
              Export your history for safekeeping. JSON is lightweight; ZIP includes multiple formats per output.
            </p>
            <div className="settings-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportJson}
                disabled={loading || !documents?.documents || documents.documents.length === 0}
              >
                {busyAction === "export-json" ? "Preparing JSON..." : "Export all (JSON)"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExportZip}
                disabled={loading || !documents?.documents || documents.documents.length === 0}
              >
                {busyAction === "export-zip" ? "Preparing ZIP..." : "Export all (ZIP)"}
              </button>
            </div>
          </div>

          <div className="settings-card-block">
            <div className="settings-card-title">Import</div>
            <p className="settings-card-copy">
              Import a previous export. Importing will NOT delete any of your existing conversations.
            </p>
            <div className="settings-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {busyAction === "import" ? "Importing..." : "Import"}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="settings-hidden-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-section-header">
          <h3>Chat History</h3>
          {selectedDocs.size > 0 && (
            <button
              type="button"
              className="btn btn-danger btn-small"
              onClick={handleDeleteSelected}
              disabled={loading}
            >
              {busyAction === "delete" ? `Deleting (${selectedDocs.size})...` : `Delete Selected (${selectedDocs.size})`}
            </button>
          )}
        </div>

        {documents?.documents && documents.documents.length > 0 ? (
          <div className="settings-history-list">
            {documents.documents.map((doc: any) => (
              <div key={doc._id} className="settings-history-item">
                <input
                  type="checkbox"
                  checked={selectedDocs.has(doc._id)}
                  onChange={() => toggleSelect(doc._id)}
                  disabled={loading}
                />
                <div className="settings-history-item-content">
                  <div className="settings-history-item-title">{doc.title}</div>
                  <div className="settings-history-item-meta">
                    {new Date(doc.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="field-hint">No history yet. Generate something first and it will show up here.</p>
        )}
      </div>
    </section>
  );
}
