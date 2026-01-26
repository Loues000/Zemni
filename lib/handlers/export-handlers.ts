import type { OutputKind, Status, Subject } from "@/types";
import { getSummaryTitle } from "@/lib/output-previews";
import { getDocumentTitle } from "@/lib/document-title";
import { createPdfId } from "@/lib/output-previews";

export interface ExportHandlersContext {
  currentKind: OutputKind;
  currentSummary: string;
  fileName: string;
  selectedSubject: string;
  subjects: Subject[];
  extractedText: string;
  outputs: Record<string, any>;
  structureHints: string;
  currentHistoryId: string | null;
  pendingExport: boolean;
  setError: (error: string) => void;
  setStatus: (status: Status) => void;
  setSelectedSubject: (subjectId: string) => void;
  setPendingExport: (pending: boolean) => void;
  setSubjectPickerOpen: (open: boolean) => void;
  setExportProgress: (progress: { current: number; total: number } | null) => void;
  setLastExportedPageId: (id: string | null) => void;
  setLoadedFromHistory: (loaded: boolean) => void;
  updateHistoryState: (updater: (prev: any[]) => any[]) => void;
}

/**
 * Handles subject selection for export
 */
export const handleSubjectPicked = (
  subjectId: string,
  context: ExportHandlersContext,
  onExport: (subjectId: string) => Promise<void>
): void => {
  const { setSelectedSubject, setSubjectPickerOpen, setPendingExport } = context;
  setSelectedSubject(subjectId);
  setSubjectPickerOpen(false);
  if (context.pendingExport) {
    setPendingExport(false);
    void onExport(subjectId);
    return;
  }
  setPendingExport(false);
};

/**
 * Handles export to Notion
 */
export const handleExport = async (
  overrideSubjectId: string | undefined,
  context: ExportHandlersContext
): Promise<void> => {
  const {
    currentKind,
    currentSummary,
    fileName,
    selectedSubject,
    subjects,
    extractedText,
    outputs,
    structureHints,
    currentHistoryId,
    setError,
    setStatus,
    setPendingExport,
    setSubjectPickerOpen,
    setExportProgress,
    setLastExportedPageId,
    setLoadedFromHistory,
    updateHistoryState
  } = context;

  const subjectId = overrideSubjectId ?? "";
  if (currentKind !== "summary") {
    setError("Only summaries can be exported to Notion.");
    setStatus("error");
    return;
  }
  if (!currentSummary) {
    setError("No summary to export.");
    setStatus("error");
    return;
  }
  if (!subjectId) {
    setError("");
    setPendingExport(true);
    setSubjectPickerOpen(true);
    return;
  }
  setError("");
  setStatus("exporting");
  setExportProgress(null);
  setLastExportedPageId(null);
  setPendingExport(false);

  try {
    const title = getSummaryTitle(currentSummary, fileName || "Summary");
    const res = await fetch("/api/notion/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        title,
        markdown: currentSummary,
        stream: true
      })
    });

    if (!res.ok) throw new Error("Notion export failed.");

    const reader = res.body?.getReader();
    if (!reader) throw new Error("Stream not available.");

    const decoder = new TextDecoder();
    let buffer = "";
    let exportedPageId: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as { type: string; [key: string]: unknown };
          if (event.type === "started") {
            setExportProgress({ current: 0, total: event.totalChunks as number });
          } else if (event.type === "chunk") {
            setExportProgress({ current: event.index as number, total: event.totalChunks as number });
          } else if (event.type === "done") {
            exportedPageId = event.pageId as string;
            setLastExportedPageId(exportedPageId);
          } else if (event.type === "error") {
            throw new Error(event.message as string || "Export failed");
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== "Export failed") {
            console.warn("Failed to parse export event:", parseErr);
          } else {
            throw parseErr;
          }
        }
      }
    }

    setStatus("ready");
    setExportProgress(null);
    const subjectTitle = subjects.find((s) => s.id === selectedSubject)?.title;
    setLoadedFromHistory(false);
    if (outputs && extractedText && subjectTitle) {
      saveToHistory(
        outputs,
        extractedText,
        fileName,
        structureHints,
        currentHistoryId,
        updateHistoryState,
        subjectTitle,
        exportedPageId || undefined
      );
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
    setStatus("error");
    setExportProgress(null);
  }
};

/**
 * Saves current state to history
 */
const saveToHistory = (
  outputs: Record<string, any>,
  extractedText: string,
  fileName: string,
  structureHints: string,
  currentHistoryId: string | null,
  updateHistoryState: (updater: (prev: any[]) => any[]) => void,
  exportedSubjectTitle?: string,
  notionPageId?: string
): void => {
  if (!extractedText || Object.keys(outputs).length === 0) return;

  const { getSummaryTitle, createPdfId } = require("@/lib/output-previews");
  const { getDocumentTitle } = require("@/lib/document-title");

  const derivedTitle = getDocumentTitle(extractedText, fileName);
  const summaryTab = Object.values(outputs).find((o) => (o.kind ?? "summary") === "summary" && (o.summary ?? "").trim().length > 0);
  const title = summaryTab ? getSummaryTitle(summaryTab.summary ?? "", derivedTitle) : derivedTitle;
  const pdfId = createPdfId(fileName || "untitled", extractedText);
  const historyId = currentHistoryId || pdfId;
  const now = Date.now();

  updateHistoryState((prev) => {
    const existingEntry = prev.find((h) => {
      const hPdfId = createPdfId(h.fileName, h.extractedText);
      return hPdfId === pdfId;
    });

    let finalExportedSubject: string | undefined;
    if (exportedSubjectTitle !== undefined) {
      finalExportedSubject = exportedSubjectTitle || undefined;
    } else {
      finalExportedSubject = existingEntry?.exportedSubject;
    }

    const entry = {
      id: historyId,
      title,
      fileName,
      extractedText,
      outputs,
      structureHints,
      createdAt: existingEntry?.createdAt || now,
      updatedAt: now,
      exportedSubject: finalExportedSubject,
      notionPageId: notionPageId || existingEntry?.notionPageId
    };

    const filtered = prev.filter((item) => {
      if (item.id === entry.id) return false;
      if (existingEntry && item.id === existingEntry.id) return false;
      return true;
    });

    return [entry, ...filtered];
  });
};
