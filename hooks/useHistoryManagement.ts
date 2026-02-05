import { useCallback } from "react";
import type { HistoryEntry, OutputEntry, Status } from "@/types";

interface UseHistoryManagementProps {
  fileHandling: {
    extractedText: string;
    fileName: string;
    setFileName: (name: string) => void;
    setExtractedText: (text: string) => void;
  };
  outputs: Record<string, OutputEntry>;
  structureHints: string;
  currentHistoryId: string | null;
  setCurrentHistoryId: (id: string | null) => void;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>;
  setStructureHints: (hints: string) => void;
  setLoadedFromHistory: (loaded: boolean) => void;
  setError: (error: string) => void;
  setSidebarOpen: (open: boolean) => void;
  isSmallScreen: boolean;
  setMobileView: (view: "input" | "output") => void;
  setIsEditing: (editing: boolean) => void;
  setIsEditingSecond: (editing: boolean) => void;
  setSecondTabId: (id: string | null) => void;
  setSelectedTabId: (id: string | null) => void;
  setSelectedModel: (modelId: string) => void;
  exportHook: {
    setLastExportedPageId: (id: string | null) => void;
    setExportProgress: (progress: { current: number; total: number } | null) => void;
  };
  setMessages: (messages: any[]) => void;
  setInput: (input: string) => void;
  setData: (data: any[]) => void;
  updateHistoryState: (updater: (prev: HistoryEntry[]) => HistoryEntry[]) => void;
  saveEntryToConvex?: (entry: HistoryEntry) => Promise<string>;
  setSaveError?: (error: string | null) => void;
  currentUser?: any;
}

/**
 * Provide handlers to save, load, and delete history entries for the current document and outputs.
 *
 * saveToHistory persists the current file, extracted text, outputs, and metadata to local history and,
 * when an async saver is provided and a user is available, also attempts optional remote persistence.
 *
 * @returns An object with:
 *  - `saveToHistory` — save the current UI state and outputs to history (optionally triggers remote save);
 *  - `loadFromHistory` — load a given `HistoryEntry` into the UI and app state;
 *  - `deleteHistoryEntry` — remove a history entry by id.
 */
export function useHistoryManagement({
  fileHandling,
  outputs,
  structureHints,
  currentHistoryId,
  setCurrentHistoryId,
  setOutputs,
  setStructureHints,
  setLoadedFromHistory,
  setError,
  setSidebarOpen,
  isSmallScreen,
  setMobileView,
  setIsEditing,
  setIsEditingSecond,
  setSecondTabId,
  setSelectedTabId,
  setSelectedModel,
  exportHook,
  setMessages,
  setInput,
  setData,
  updateHistoryState,
  saveEntryToConvex,
  setSaveError,
  currentUser,
}: UseHistoryManagementProps) {
  /**
   * Save current state to history
   * Note: This now supports both sync (localStorage) and async (Convex) saves
   */
  const saveToHistory = useCallback((outputsToSave?: Record<string, OutputEntry>, exportedSubjectTitle?: string, notionPageId?: string): void => {
    const { saveToHistoryInternal } = require("@/lib/history-utils");
    saveToHistoryInternal({
      outputs: outputsToSave || outputs,
      extractedText: fileHandling.extractedText,
      fileName: fileHandling.fileName,
      structureHints,
      currentHistoryId,
      updateHistoryState,
      exportedSubjectTitle,
      notionPageId,
      setCurrentHistoryId
    });

    // If we have async save capability, also save to Convex
    if (saveEntryToConvex && fileHandling.extractedText && Object.keys(outputsToSave || outputs).length > 0) {
      const { getDocumentTitle } = require("@/lib/document-title");
      const { getSummaryTitle, createPdfId } = require("@/lib/output-previews");

      // Build the entry that was just saved
      const currentOutputs = outputsToSave || outputs;
      const derivedTitle = getDocumentTitle(fileHandling.extractedText, fileHandling.fileName);
      const summaryTab = Object.values(currentOutputs).find(
        (o) => (o.kind ?? "summary") === "summary" && (o.summary ?? "").trim().length > 0
      );
      const title = summaryTab ? getSummaryTitle(summaryTab.summary ?? "", derivedTitle) : derivedTitle;
      const pdfId = createPdfId(fileHandling.fileName || "untitled", fileHandling.extractedText);
      const now = Date.now();

      const entry: HistoryEntry = {
        id: currentHistoryId || pdfId,
        title,
        fileName: fileHandling.fileName,
        extractedText: fileHandling.extractedText,
        outputs: currentOutputs,
        structureHints,
        createdAt: now,
        updatedAt: now,
        exportedSubject: exportedSubjectTitle,
        notionPageId,
      };

      // If user is available, save immediately
      if (currentUser) {
        saveEntryToConvex(entry).catch((error: Error) => {
          console.error("[useHistoryManagement] Async save failed:", error);
          if (setSaveError) {
            setSaveError(error.message);
          }
        });
      }
      // Note: If user not available yet, the save will be lost. 
      // This is acceptable since the entry is already in local state and will be saved on next update.
    }
  }, [outputs, fileHandling.extractedText, fileHandling.fileName, structureHints, currentHistoryId, updateHistoryState, setCurrentHistoryId, saveEntryToConvex, setSaveError, currentUser]);

  const loadFromHistory = useCallback((entry: HistoryEntry): void => {
    fileHandling.setFileName(entry.fileName);
    fileHandling.setExtractedText(entry.extractedText);
    setOutputs(entry.outputs);
    setStructureHints(entry.structureHints);
    setCurrentHistoryId(entry.id);
    setLoadedFromHistory(true);
    setError("");
    setSidebarOpen(false);
    if (isSmallScreen) setMobileView("output");
    setIsEditing(false);
    setIsEditingSecond(false);
    setSecondTabId(null);
    if (entry.notionPageId) {
      exportHook.setLastExportedPageId(entry.notionPageId);
    } else {
      exportHook.setLastExportedPageId(null);
    }
    exportHook.setExportProgress(null);
    setMessages([]);
    setInput("");
    setData([]);
    const firstTabId = Object.keys(entry.outputs)[0];
    if (firstTabId) {
      setSelectedTabId(firstTabId);
      const tab = entry.outputs[firstTabId];
      if (tab) setSelectedModel(tab.modelId);
    }
  }, [fileHandling, setOutputs, setStructureHints, setCurrentHistoryId, setLoadedFromHistory, setError, setSidebarOpen, isSmallScreen, setMobileView, setIsEditing, setIsEditingSecond, setSecondTabId, exportHook, setMessages, setInput, setData, setSelectedTabId, setSelectedModel]);

  const deleteHistoryEntry = useCallback((id: string, event: React.MouseEvent): void => {
    event.stopPropagation();
    updateHistoryState((prev) => prev.filter((entry) => entry.id !== id));
  }, [updateHistoryState]);

  return {
    saveToHistory,
    loadFromHistory,
    deleteHistoryEntry
  };
}