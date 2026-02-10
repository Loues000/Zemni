import type { OutputKind, Status, Subject } from "@/types";
import { getSummaryTitle } from "@/lib/output-previews";
import { getDocumentTitle } from "@/lib/document-title";
import { createPdfId } from "@/lib/output-previews";

export interface NotionConfig {
  token: string | null;
  databaseId: string | null;
  exportMethod: "database" | "page";
  autoCreateFoldersFromNotionSubjects?: boolean;
}

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
  addHistoryFolder?: (name: string) => Promise<void>;
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
  context: ExportHandlersContext,
  notionConfig?: NotionConfig
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

  // Get Notion config from parameter or fallback to localStorage (for unauthenticated users)
  const config = notionConfig || {
    token: typeof window !== "undefined" ? localStorage.getItem("notion_token") : null,
    databaseId: typeof window !== "undefined" ? localStorage.getItem("notion_database_id") : null,
    exportMethod: (typeof window !== "undefined" ? localStorage.getItem("notion_export_method") : "database") as "database" | "page" || "database",
  };

  const useDatabase = config.exportMethod !== "page";

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

  // For database export, require subjectId. For page export, skip subject picker.
  if (useDatabase && !subjectId) {
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

    // For database export, use subjectId. For page export, use pageId (or undefined to create in workspace)
    const exportBody: any = {
      title,
      markdown: currentSummary,
      stream: true,
      notionToken: config.token || undefined
    };

    if (useDatabase && subjectId) {
      exportBody.subjectId = subjectId;
    } else if (!useDatabase) {
      // For direct page export, we can optionally specify a parent pageId
      // If not specified, it will create in workspace root
      // For now, we'll create in workspace root (no parent)
    }

    const res = await fetch("/api/notion/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportBody)
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
          const event = JSON.parse(line) as { type: string;[key: string]: unknown };
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
    // Prefer overrideSubjectId (subjectId) when provided to ensure history uses the exported subject.
    const effectiveSubjectId = subjectId || selectedSubject;
    const subjectTitle = subjects.find((s) => s.id === effectiveSubjectId)?.title;
    setLoadedFromHistory(false);
    
    // Auto-create folder from Notion subject if enabled
    let folderName: string | undefined;
    if (subjectTitle && config?.autoCreateFoldersFromNotionSubjects && useDatabase) {
      folderName = subjectTitle;
      // Add folder to user's folders (if it doesn't exist)
      if (context.addHistoryFolder) {
        try {
          await context.addHistoryFolder(folderName);
        } catch (err) {
          console.error("[export-handlers] Failed to add folder:", err);
        }
      }
    }
    
    if (outputs && extractedText && subjectTitle) {
      saveToHistory(
        outputs,
        extractedText,
        fileName,
        structureHints,
        currentHistoryId,
        updateHistoryState,
        subjectTitle,
        exportedPageId || undefined,
        folderName
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
  notionPageId?: string,
  folder?: string
): void => {
  const { saveToHistoryInternal } = require("@/lib/history-utils");
  saveToHistoryInternal({
    outputs,
    extractedText,
    fileName,
    structureHints,
    currentHistoryId,
    updateHistoryState,
    exportedSubjectTitle,
    notionPageId,
    folder
  });
};
