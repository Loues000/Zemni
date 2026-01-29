import type { HistoryEntry } from "@/types";

export const HISTORY_STORAGE_KEY = "summary-maker-history-v1";

export const isHistoryEntry = (value: unknown): value is HistoryEntry => {
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

export const sortHistory = (entries: HistoryEntry[]): HistoryEntry[] => {
  return entries.slice().sort((a, b) => b.updatedAt - a.updatedAt);
};

/**
 * Load history from localStorage (legacy, for backward compatibility)
 */
export const loadHistoryFromStorage = (): HistoryEntry[] => {
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
};

/**
 * Save history to localStorage (legacy, for backward compatibility)
 */
export const saveHistoryToStorage = (entries: HistoryEntry[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    // Ignore storage errors
  }
};

/**
 * Convert Convex document to HistoryEntry format
 */
export function documentToHistoryEntry(doc: {
  _id: string;
  title: string;
  fileName: string;
  extractedText: string;
  outputs: any;
  structureHints: string;
  createdAt: number;
  updatedAt: number;
  exportedSubject?: string;
  notionPageId?: string;
}): HistoryEntry {
  return {
    id: doc._id,
    title: doc.title,
    fileName: doc.fileName,
    extractedText: doc.extractedText,
    outputs: doc.outputs || {},
    structureHints: doc.structureHints,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    exportedSubject: doc.exportedSubject,
    notionPageId: doc.notionPageId,
  };
}

/**
 * Convert HistoryEntry to Convex document format
 */
export function historyEntryToDocument(entry: HistoryEntry, userId: string): {
  title: string;
  fileName: string;
  extractedText: string;
  outputs: any;
  structureHints: string;
  createdAt: number;
  updatedAt: number;
  exportedSubject?: string;
  notionPageId?: string;
} {
  return {
    title: entry.title,
    fileName: entry.fileName,
    extractedText: entry.extractedText,
    outputs: entry.outputs,
    structureHints: entry.structureHints,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    exportedSubject: entry.exportedSubject,
    notionPageId: entry.notionPageId,
  };
}
