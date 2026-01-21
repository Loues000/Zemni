import { useState, useEffect, useCallback } from "react";
import type { HistoryEntry } from "@/types";

const HISTORY_STORAGE_KEY = "summary-maker-history-v1";

const isHistoryEntry = (value: unknown): value is HistoryEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as HistoryEntry;
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.fileName === "string" &&
    typeof entry.extractedText === "string" &&
    typeof entry.structureHints === "string" &&
    typeof entry.createdAt === "number" &&
    typeof entry.updatedAt === "number" &&
    typeof entry.outputs === "object" &&
    entry.outputs !== null
  );
};

const sortHistory = (entries: HistoryEntry[]): HistoryEntry[] => {
  return entries.slice().sort((a, b) => b.updatedAt - a.updatedAt);
};

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistoryFromStorage = useCallback((): HistoryEntry[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return sortHistory(parsed.filter(isHistoryEntry));
    } catch (e) {
      return [];
    }
  }, []);

  const saveHistoryToStorage = useCallback((entries: HistoryEntry[]): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  const updateHistoryState = useCallback((updater: (prev: HistoryEntry[]) => HistoryEntry[]): void => {
    setHistory((prev) => {
      const next = sortHistory(updater(prev));
      saveHistoryToStorage(next);
      return next;
    });
  }, [saveHistoryToStorage]);

  useEffect(() => {
    setHistory(loadHistoryFromStorage());
  }, [loadHistoryFromStorage]);

  return { history, updateHistoryState };
}
