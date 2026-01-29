"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { documentToHistoryEntry, sortHistory } from "@/lib/history-storage";
import type { HistoryEntry } from "@/types";
import { useCallback } from "react";

/**
 * Hook to manage history using Convex
 * Replaces the localStorage-based useHistory hook
 */
export function useHistoryConvex() {
  const documents = useQuery(api.documents.list, { limit: 1000 });
  const upsertDoc = useMutation(api.documents.upsert);
  const deleteDoc = useMutation(api.documents.remove);

  const history: HistoryEntry[] = documents?.documents
    ? sortHistory(documents.documents.map(documentToHistoryEntry))
    : [];

  const updateHistoryState = useCallback(
    (updater: (prev: HistoryEntry[]) => HistoryEntry[]) => {
      const updated = updater(history);

      // Update each document in Convex
      updated.forEach((entry) => {
        upsertDoc({
          documentId: entry.id as any,
          title: entry.title,
          fileName: entry.fileName,
          extractedText: entry.extractedText,
          outputs: entry.outputs,
          structureHints: entry.structureHints,
        }).catch((err) => {
          console.error("Failed to update document:", err);
        });
      });
    },
    [history, upsertDoc]
  );

  const deleteHistoryEntry = useCallback(
    (entryId: string) => {
      deleteDoc({ documentId: entryId as any }).catch((err) => {
        console.error("Failed to delete document:", err);
      });
    },
    [deleteDoc]
  );

  return {
    history,
    updateHistoryState,
    deleteHistoryEntry,
    isLoading: documents === undefined,
  };
}
