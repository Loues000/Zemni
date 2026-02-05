import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { HistoryEntry, OutputEntry } from "@/types";
import type { Id } from "@/convex/_generated/dataModel";
import { documentToHistoryEntry, historyEntryToDocument, sortHistory } from "@/lib/history-storage";
import { toast } from "sonner";

// Helper to check if a string is a valid Convex ID
const isValidConvexId = (id: string): boolean => {
  return typeof id === "string" && /^[jk][a-z0-9]{24}$/.test(id);
};

// Retry configuration
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

/**
 * Provides history state and persistence helpers for reading, updating, and saving user documents.
 *
 * Exposes the current history entries and flags for loading/saving, plus helpers to modify state and persist entries to Convex or localStorage.
 *
 * @returns An object containing:
 *  - `history` — the sorted list of `HistoryEntry` items.
 *  - `isLoading` — `true` while initial history is being loaded.
 *  - `isSaving` — `true` while one or more entries are being saved.
 *  - `saveError` — last save error message, or `null` if none.
 *  - `lastSavedAt` — `Date` of the most recent successful save, or `null`.
 *  - `pendingSaves` — number of saves currently pending.
 *  - `updateHistoryState` — a function `(updater) => void` to apply local updates to history; will persist changed entries (to Convex when authenticated, otherwise to localStorage).
 *  - `saveEntryToConvex` — a function `(entry) => Promise<string>` that persists a single entry to Convex and returns its document ID.
 *  - `saveAllEntriesToConvex` — a function `(entries) => Promise<void>` that persists multiple entries sequentially.
 *  - `clearSaveError` — a function `() => void` to clear the current save error.
 *  - `retryFailedSaves` — a function `() => Promise<void>` to retry any previously failed saves.
 */
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
  
  // Track failed saves for retry
  const failedSavesRef = useRef<HistoryEntry[]>([]);

  // DEBUG: Uncomment to debug connection issues
  // useEffect(() => {
  //   console.log('[DEBUG useHistory] currentUser:', currentUser ? `ID: ${currentUser._id}, Tier: ${currentUser.subscriptionTier}` : 'null');
  //   console.log('[DEBUG useHistory] documents:', documents ? `${documents.length} docs` : 'null');
  // }, [currentUser, documents]);

  // Convert Convex documents to HistoryEntry format
  const historyFromConvex = useMemo(() => {
    if (!documents) return [];
    return documents.map(documentToHistoryEntry);
  }, [documents]);

  // Load history from Convex when available, fallback to localStorage for unauthenticated users
  useEffect(() => {
    if (currentUser === undefined) {
      // Still loading user
      return;
    }

    if (currentUser && documents !== undefined) {
      // User is authenticated, use Convex
      setIsLoading(false);
      setHistory(sortHistory(historyFromConvex));
    } else if (!currentUser) {
      // Not authenticated, fallback to localStorage
      setIsLoading(false);
      const { loadHistoryFromStorage } = require("@/lib/history-storage");
      setHistory(loadHistoryFromStorage());
    }
  }, [currentUser, documents, historyFromConvex]);

  /**
   * Save a single entry to Convex with retry logic
   */
  const saveEntryToConvex = useCallback(async (entry: HistoryEntry, retryCount = 0): Promise<string> => {
    // DEBUG: Uncomment to debug save operations
    // console.log('[DEBUG saveEntryToConvex] Called with entry ID:', entry.id, 'Retry:', retryCount);
    
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    try {
      const docData = historyEntryToDocument(entry, currentUser._id);
      
      // Try to use entry.id as documentId if it's a valid Convex ID
      const documentId: Id<"documents"> | undefined = isValidConvexId(entry.id) ? (entry.id as Id<"documents">) : undefined;

      const returnedId = await upsertDocument({
        documentId,
        title: docData.title,
        fileName: docData.fileName,
        extractedText: docData.extractedText,
        outputs: docData.outputs,
        structureHints: docData.structureHints,
      });

      // If we got a new ID from Convex, update the entry in local state
      if (returnedId && returnedId !== entry.id) {
        setHistory(current =>
          current.map(h => h.id === entry.id ? { ...h, id: returnedId } : h)
        );
      }

      setLastSavedAt(new Date());
      
      // Remove from failed saves if it was there
      failedSavesRef.current = failedSavesRef.current.filter(e => e.id !== entry.id);

      // DEBUG: Uncomment to confirm successful save
      // console.log('[DEBUG saveEntryToConvex] SUCCESS! Returned ID:', returnedId);

      return returnedId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save document";
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return saveEntryToConvex(entry, retryCount + 1);
      }
      
      // Max retries reached
      setSaveError(errorMessage);
      
      // Track for manual retry
      if (!failedSavesRef.current.find(e => e.id === entry.id)) {
        failedSavesRef.current.push(entry);
      }
      
      // Show toast notification for save failure
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

  /**
   * Save multiple entries to Convex
   */
  const saveAllEntriesToConvex = useCallback(async (entries: HistoryEntry[]): Promise<void> => {
    if (!currentUser || entries.length === 0) return;

    setIsSaving(true);
    setSaveError(null);
    setPendingSaves(entries.length);

    try {
      // Save sequentially to avoid overwhelming the server
      for (const entry of entries) {
        await saveEntryToConvex(entry);
        setPendingSaves(prev => prev - 1);
      }
    } catch (error) {
      console.error("[useHistory] Batch save failed:", error);
      // Error is already set in saveEntryToConvex
    } finally {
      setIsSaving(false);
      setPendingSaves(0);
    }
  }, [currentUser, saveEntryToConvex]);

  /**
   * Update history state with proper Convex sync
   */
  const updateHistoryState = useCallback((updater: (prev: HistoryEntry[]) => HistoryEntry[]): void => {
    // DEBUG: Uncomment to debug state updates
    // console.log('[DEBUG updateHistoryState] Called, currentUser:', currentUser ? 'exists' : 'null');
    
    if (!currentUser) {
      // Not authenticated, use localStorage fallback
      const { loadHistoryFromStorage, saveHistoryToStorage } = require("@/lib/history-storage");
      const current = loadHistoryFromStorage();
      const next = sortHistory(updater(current));
      saveHistoryToStorage(next);
      setHistory(next);
      return;
    }

    // User is authenticated, use Convex
    setHistory((prev) => {
      const next = sortHistory(updater(prev));

      // Identify entries that changed or are new
      const changedEntries = next.filter((entry) => {
        const existing = prev.find((p) => p.id === entry.id);
        // Entry is new or its content has been updated
        return !existing || existing.updatedAt !== entry.updatedAt;
      });
      
      // DEBUG: Uncomment to see how many entries changed
      // console.log('[DEBUG updateHistoryState] Changed entries:', changedEntries.length);

      // Save changed entries to Convex asynchronously
      if (changedEntries.length > 0) {
        setIsSaving(true);
        setPendingSaves(changedEntries.length);
        
        // Use Promise.all for parallel saves, but handle errors individually
        Promise.all(
          changedEntries.map(async (entry) => {
            try {
              await saveEntryToConvex(entry);
            } catch (error) {
              // Error is already handled in saveEntryToConvex
              console.error(`[useHistory] Failed to save entry ${entry.id}:`, error);
            } finally {
              setPendingSaves(prev => Math.max(0, prev - 1));
            }
          })
        ).then(() => {
          setIsSaving(false);
        }).catch(() => {
          setIsSaving(false);
        });
      }

      return next;
    });
  }, [currentUser, saveEntryToConvex]);

  /**
   * Clear save error
   */
  const clearSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  /**
   * Retry failed saves
   */
  const retryFailedSaves = useCallback(async (): Promise<void> => {
    if (failedSavesRef.current.length === 0) {
      toast.info("No failed saves to retry");
      return;
    }
    
    const toRetry = [...failedSavesRef.current];
    const retryCount = toRetry.length;
    failedSavesRef.current = [];
    
    setSaveError(null);
    
    toast.loading(`Retrying ${retryCount} failed save${retryCount > 1 ? 's' : ''}...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const entry of toRetry) {
      try {
        await saveEntryToConvex(entry);
        successCount++;
      } catch (error) {
        failCount++;
        // Already handled in saveEntryToConvex
      }
    }
    
    // Dismiss loading toast and show result
    toast.dismiss();
    
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