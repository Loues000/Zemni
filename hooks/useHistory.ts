import { useState, useEffect, useCallback } from "react";
import type { HistoryEntry } from "@/types";
import { loadHistoryFromStorage, saveHistoryToStorage, sortHistory } from "@/lib/history-storage";

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback((): HistoryEntry[] => {
    return loadHistoryFromStorage();
  }, []);

  const saveHistory = useCallback((entries: HistoryEntry[]): void => {
    saveHistoryToStorage(entries);
  }, []);

  const updateHistoryState = useCallback((updater: (prev: HistoryEntry[]) => HistoryEntry[]): void => {
    setHistory((prev) => {
      const next = sortHistory(updater(prev));
      saveHistory(next);
      return next;
    });
  }, [saveHistory]);

  useEffect(() => {
    setHistory(loadHistory());
  }, [loadHistory]);

  return { history, updateHistoryState };
}
