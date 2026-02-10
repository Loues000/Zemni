import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
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
 * Manages Notion export functionality
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
  const addHistoryFolder = useMutation(api.users.addHistoryFolder);
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
      autoCreateFoldersFromNotionSubjects: currentUser.autoCreateFoldersFromNotionSubjects ?? false,
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
    updateHistoryState,
    addHistoryFolder: async (name: string) => {
      try {
        await addHistoryFolder({ name });
      } catch (err) {
        console.error("[useExport] Failed to add history folder:", err);
      }
    },
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
