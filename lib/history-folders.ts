import type { HistoryEntry } from "@/types";

export const ALL_FOLDERS = "__all__";
export const UNSORTED_FOLDER = "__unsorted__";
export const DEFAULT_FOLDER_LABEL = "Unsorted";

export const normalizeFolder = (folder: string | null | undefined): string | null => {
  if (!folder) return null;
  const trimmed = folder.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getFolderNames = (history: HistoryEntry[], userFolders?: string[] | null): string[] => {
  const names = new Set<string>();

  (userFolders ?? []).forEach((folder) => {
    const normalized = normalizeFolder(folder);
    if (normalized) {
      names.add(normalized);
    }
  });

  history.forEach((entry) => {
    const normalized = normalizeFolder(entry.folder);
    if (normalized) {
      names.add(normalized);
    }
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b));
};
