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
}

/**
 * Manages history operations: save, load, delete
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
  updateHistoryState
}: UseHistoryManagementProps) {
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
  }, [outputs, fileHandling.extractedText, fileHandling.fileName, structureHints, currentHistoryId, updateHistoryState, setCurrentHistoryId]);

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
