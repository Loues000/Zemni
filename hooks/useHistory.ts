import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { HistoryEntry } from "@/types";
import { documentToHistoryEntry, historyEntryToDocument, sortHistory } from "@/lib/history-storage";

export function useHistory() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const documents = useQuery(api.documents.getAll);
  const upsertDocument = useMutation(api.documents.upsert);
  const removeDocument = useMutation(api.documents.remove);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const updateHistoryState = useCallback((updater: (prev: HistoryEntry[]) => HistoryEntry[]): void => {
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

      // Save only changed entries to Convex
      changedEntries.forEach((entry) => {
        (async () => {
          try {
            const docData = historyEntryToDocument(entry, currentUser._id);
            // Try to use entry.id as documentId if it's a valid Convex ID
            let documentId: any = undefined;
            if (typeof entry.id === "string" && /^[jk][a-z0-9]{24}$/.test(entry.id)) {
              documentId = entry.id as any;
            }

            const returnedId = await upsertDocument({
              documentId,
              title: docData.title,
              fileName: docData.fileName,
              extractedText: docData.extractedText,
              outputs: docData.outputs,
              structureHints: docData.structureHints,
            });

            // If we got a new ID from Convex, we should update the entry in our local state
            // so subsequent updates use the correct ID.
            if (returnedId && returnedId !== entry.id) {
              setHistory(current =>
                current.map(h => h.id === entry.id ? { ...h, id: returnedId as string } : h)
              );
            }
          } catch (error) {
            console.error("Failed to save history entry to Convex:", error);
          }
        })();
      });

      return next;
    });
  }, [currentUser, upsertDocument]);

  return { history, updateHistoryState, isLoading };
}
