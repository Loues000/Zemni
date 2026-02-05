import { useState, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { OutputKind, Status, Subject } from "@/types";
import { handleExport as handleExportHandler, handleSubjectPicked as handleSubjectPickedHandler, type ExportHandlersContext, type NotionConfig } from "@/lib/handlers/export-handlers";
import type { HistoryEntry } from "@/types";

export interface UseExportReturn {
  exportProgress: { current: number; total: number } | null;
  setExportProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number } | null>>;
  lastExportedPageId: string | null;
  setLastExportedPageId: React.Dispatch<React.SetStateAction<string | null>>;
  subjectPickerOpen: boolean;
  setSubjectPickerOpen: (open: boolean) => void;
  pendingExport: boolean;
  setPendingExport: React.Dispatch<React.SetStateAction<boolean>>;
  handleExport: (overrideSubjectId?: string) => Promise<void>;
  handleSubjectPicked: (subjectId: string) => void;
}

/**
 * Provides state and handlers for exporting data to Notion and managing export-related UI.
 *
 * @param currentKind - The type of output to export (e.g., lesson, summary).
 * @param currentSummary - The textual summary associated with the current export.
 * @param fileName - Desired filename or title for the exported Notion page or database entry.
 * @param selectedSubject - Identifier of the currently selected subject for the export.
 * @param subjects - Available subjects the user can choose from.
 * @param extractedText - The main extracted text content to include in the export.
 * @param outputs - Auxiliary output data keyed by identifier used during export.
 * @param structureHints - Hints about how to structure the exported content.
 * @param currentHistoryId - Identifier of the currently loaded history entry, or `null` if none.
 * @param setError - Setter for presenting an error message to the user.
 * @param setStatus - Setter for updating the overall export status.
 * @param setSelectedSubject - Setter to change the selected subject.
 * @param setLoadedFromHistory - Setter to mark whether content was loaded from history.
 * @param updateHistoryState - Function to update the local history entries array.
 * @returns An object exposing export state and actions:
 * - `exportProgress` / `setExportProgress`: current and total progress for ongoing exports.
 * - `lastExportedPageId` / `setLastExportedPageId`: Notion page id of the most recent export.
 * - `subjectPickerOpen` / `setSubjectPickerOpen`: UI state for the subject picker.
 * - `pendingExport` / `setPendingExport`: whether an export is in progress.
 * - `handleExport(overrideSubjectId?)`: triggers an export, optionally overriding the selected subject.
 * - `handleSubjectPicked(subjectId)`: handles a subject selection and may initiate export flow.
 */
export function useExport(
  currentKind: OutputKind,
  currentSummary: string,
  fileName: string,
  selectedSubject: string,
  subjects: Subject[],
  extractedText: string,
  outputs: Record<string, any>,
  structureHints: string,
  currentHistoryId: string | null,
  setError: (error: string) => void,
  setStatus: (status: Status) => void,
  setSelectedSubject: (subjectId: string) => void,
  setLoadedFromHistory: (loaded: boolean) => void,
  updateHistoryState: (updater: (prev: HistoryEntry[]) => HistoryEntry[]) => void
): UseExportReturn {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastExportedPageId, setLastExportedPageId] = useState<string | null>(null);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [pendingExport, setPendingExport] = useState(false);

  // Load Notion config from Convex
  // Token will be decrypted server-side by API endpoints
  const notionConfig: NotionConfig | undefined = useMemo(() => {
    if (!currentUser || !currentUser.notionToken) return undefined;
    
    // Pass encrypted token - API endpoint will decrypt server-side
    return {
      token: currentUser.notionToken,
      databaseId: currentUser.notionDatabaseId || null,
      exportMethod: currentUser.notionExportMethod || "database",
    };
  }, [currentUser]);

  const context: ExportHandlersContext = {
    currentKind,
    currentSummary,
    fileName,
    selectedSubject,
    subjects,
    extractedText,
    outputs,
    structureHints,
    currentHistoryId,
    pendingExport,
    setError,
    setStatus,
    setSelectedSubject,
    setPendingExport,
    setSubjectPickerOpen,
    setExportProgress,
    setLastExportedPageId,
    setLoadedFromHistory,
    updateHistoryState
  };

  const handleExport = useCallback(async (overrideSubjectId?: string) => {
    await handleExportHandler(overrideSubjectId, context, notionConfig);
  }, [context, notionConfig]);

  const handleSubjectPicked = useCallback((subjectId: string) => {
    handleSubjectPickedHandler(subjectId, context, handleExport);
  }, [context, handleExport]);

  return {
    exportProgress,
    setExportProgress,
    lastExportedPageId,
    setLastExportedPageId,
    subjectPickerOpen,
    setSubjectPickerOpen,
    pendingExport,
    setPendingExport,
    handleExport,
    handleSubjectPicked
  };
}