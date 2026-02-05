"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { exportHistoryAsZip } from "@/lib/export-history-zip";

/**
 * Export, import, and manage chat history entries.
 */
export function HistorySyncTab() {
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documents = useQuery(api.documents.list, { limit: 100 });
  const deleteDoc = useMutation(api.documents.remove);
  const upsertDoc = useMutation(api.documents.upsert);

  const handleExportJson = useCallback(() => {
    if (!documents?.documents) return;

    try {
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
    } catch (err) {
      console.error("Failed to export:", err);
    }
  }, [documents]);

  const handleExportZip = useCallback(async () => {
    if (!documents?.documents) return;

    try {
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
    } catch (err) {
      console.error("Failed to export ZIP:", err);
    }
  }, [documents]);

  const handleImport = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { entries?: unknown[] } | unknown[];
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;

      if (!entries || !Array.isArray(entries)) {
        alert("Invalid file format");
        return;
      }

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (const entry of entries) {
        try {
          // Validate entry structure
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

          // Skip entries without text content
          if (!extractedText.trim()) {
            skipped++;
            continue;
          }

          // Import the document (upsert will handle duplicates)
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

      // Show results
      const message = `Imported ${imported} document(s)${skipped > 0 ? `, skipped ${skipped}` : ""}${errors > 0 ? `, ${errors} errors` : ""}`;
      alert(message);
    } catch (err) {
      console.error("Failed to import:", err);
      alert("Failed to import history. Please check the file format.");
    } finally {
      setLoading(false);
    }
  }, [upsertDoc]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedDocs.size === 0) return;
    if (!confirm(`Delete ${selectedDocs.size} document(s)?`)) return;

    setLoading(true);
    try {
      for (const docId of selectedDocs) {
        await deleteDoc({ documentId: docId as any });
      }
      setSelectedDocs(new Set());
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDocs, deleteDoc]);

  /**
   * Toggle the selection state for a document.
   */
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
                disabled={!documents?.documents || documents.documents.length === 0}
              >
                ↑ Export all (JSON)
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExportZip}
                disabled={!documents?.documents || documents.documents.length === 0}
              >
                ↑ Export all (ZIP)
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
                ↓ Import
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
              Delete Selected ({selectedDocs.size})
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
