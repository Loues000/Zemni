import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { HistoryEntry } from "@/types";
import {
  documentToHistoryEntry,
  historyEntryToDocument,
  loadHistoryFromStorage,
  saveHistoryToStorage,
  sortHistory,
} from "@/lib/history-storage";
import { toast } from "sonner";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export interface UseHistoryReturn {
  history: HistoryEntry[];
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: Date | null;
  pendingSaves: number;
  updateHistoryState: (updater: (prev: HistoryEntry[]) => HistoryEntry[]) => void;
  saveEntryToConvex: (entry: HistoryEntry) => Promise<string>;
  saveAllEntriesToConvex: (entries: HistoryEntry[]) => Promise<void>;
  clearSaveError: () => void;
  retryFailedSaves: () => Promise<void>;
}

export function useHistory(): UseHistoryReturn {
  const currentUser = useQuery(api.users.getCurrentUser);
  const documents = useQuery(api.documents.getAll);
  const upsertDocument = useMutation(api.documents.upsert);
  const removeDocument = useMutation(api.documents.remove);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  
  const failedSavesRef = useRef<HistoryEntry[]>([]);
  const historyRef = useRef<HistoryEntry[]>([]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const historyFromConvex = useMemo(() => {
    if (!documents) return [];
    return documents.map(documentToHistoryEntry);
  }, [documents]);

  useEffect(() => {
    if (currentUser === undefined) {
      return;
    }

    if (currentUser && documents !== undefined) {
      setIsLoading(false);
      setHistory(sortHistory(historyFromConvex));
    } else if (!currentUser) {
      setIsLoading(false);
      setHistory(loadHistoryFromStorage());
    }
  }, [currentUser, documents, historyFromConvex]);

  const saveEntryToConvex = useCallback(async (entry: HistoryEntry, retryCount = 0): Promise<string> => {
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    try {
      const docData = historyEntryToDocument(entry, currentUser._id);

      const upsertArgs: Record<string, unknown> = {
        title: docData.title,
        fileName: docData.fileName,
        extractedText: docData.extractedText,
        outputs: docData.outputs,
        structureHints: docData.structureHints,
      };
      if (docData.folder !== undefined) {
        upsertArgs.folder = docData.folder;
      }
      if (docData.exportedSubject !== undefined) {
        upsertArgs.exportedSubject = docData.exportedSubject;
      }
      if (docData.notionPageId !== undefined) {
        upsertArgs.notionPageId = docData.notionPageId;
      }

      const returnedId = await upsertDocument(upsertArgs as any);

      if (returnedId && returnedId !== entry.id) {
        setHistory(current =>
          current.map(h => h.id === entry.id ? { ...h, id: returnedId } : h)
        );
      }

      setLastSavedAt(new Date());
      
      failedSavesRef.current = failedSavesRef.current.filter(e => e.id !== entry.id);

      return returnedId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save document";
      
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return saveEntryToConvex(entry, retryCount + 1);
      }
      
      setSaveError(errorMessage);
      
      if (!failedSavesRef.current.find(e => e.id === entry.id)) {
        failedSavesRef.current.push(entry);
      }
      
      toast.error("Failed to save document", {
        description: errorMessage,
        duration: 8000,
        action: {
          label: "Retry",
          onClick: () => {
            retryFailedSaves();
          }
        }
      });
      
      throw error;
    }
  }, [currentUser, upsertDocument]);

  const saveAllEntriesToConvex = useCallback(async (entries: HistoryEntry[]): Promise<void> => {
    if (!currentUser || entries.length === 0) return;

    setIsSaving(true);
    setSaveError(null);
    setPendingSaves(entries.length);

    try {
      for (const entry of entries) {
        await saveEntryToConvex(entry);
        setPendingSaves(prev => prev - 1);
      }
    } catch (error) {
      console.error("[useHistory] Batch save failed:", error);
    } finally {
      setIsSaving(false);
      setPendingSaves(0);
    }
  }, [currentUser, saveEntryToConvex]);

  const updateHistoryState = useCallback((updater: (prev: HistoryEntry[]) => HistoryEntry[]): void => {
    if (!currentUser) {
      const current = loadHistoryFromStorage();
      const next = sortHistory(updater(current));
      saveHistoryToStorage(next);
      setHistory(next);
      return;
    }

    const prev = historyRef.current;
    const next = sortHistory(updater(prev));

    const changedEntries = next.filter((entry) => {
      const existing = prev.find((p) => p.id === entry.id);
      return !existing || existing.updatedAt !== entry.updatedAt;
    });

    historyRef.current = next;
    setHistory(next);

    if (changedEntries.length > 0) {
      setIsSaving(true);
      setPendingSaves(changedEntries.length);

      Promise.all(
        changedEntries.map(async (entry) => {
          try {
            await saveEntryToConvex(entry);
          } catch (error) {
            console.error(`[useHistory] Failed to save entry ${entry.id}:`, error);
          } finally {
            setPendingSaves((prevPending) => Math.max(0, prevPending - 1));
          }
        })
      )
        .then(() => {
          setIsSaving(false);
        })
        .catch(() => {
          setIsSaving(false);
        });
    }
  }, [currentUser, saveEntryToConvex]);

  const clearSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  const retryFailedSaves = useCallback(async (): Promise<void> => {
    if (failedSavesRef.current.length === 0) {
      toast.info("No failed saves to retry");
      return;
    }
    
    const toRetry = [...failedSavesRef.current];
    const retryCount = toRetry.length;
    failedSavesRef.current = [];
    
    setSaveError(null);
    
    const loadingToastId = toast.loading(
      `Retrying ${retryCount} failed save${retryCount > 1 ? "s" : ""}...`
    );
    
    let successCount = 0;
    let failCount = 0;
    
    for (const entry of toRetry) {
      try {
        await saveEntryToConvex(entry);
        successCount++;
      } catch (error) {
        failCount++;
      }
    }
    
    toast.dismiss(loadingToastId);
    
    if (successCount > 0 && failCount === 0) {
      toast.success(`Successfully saved ${successCount} document${successCount > 1 ? 's' : ''}`);
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`Saved ${successCount} document${successCount > 1 ? 's' : ''}, ${failCount} failed`);
    } else {
      toast.error(`All ${failCount} retry attempts failed`);
    }
  }, [saveEntryToConvex]);

  return {
    history,
    isLoading,
    isSaving,
    saveError,
    lastSavedAt,
    pendingSaves,
    updateHistoryState,
    saveEntryToConvex,
    saveAllEntriesToConvex,
    clearSaveError,
    retryFailedSaves,
  };
}
