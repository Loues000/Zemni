import { useEffect } from "react";
import type { OutputKind } from "@/types";

interface UseKeyboardShortcutsProps {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  subjectPickerOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSubjectPickerOpen: (open: boolean) => void;
  fileHandling: { extractedText: string };
  selectedModel: string;
  generatingTabId: string | null;
  currentSummary: string;
  isEditing: boolean;
  isEditingSecond: boolean;
  handleGenerate: () => Promise<void>;
}

/**
 * Manages global keyboard shortcuts
 */
export function useKeyboardShortcuts({
  sidebarOpen,
  settingsOpen,
  subjectPickerOpen,
  setSidebarOpen,
  setSettingsOpen,
  setSubjectPickerOpen,
  fileHandling,
  selectedModel,
  generatingTabId,
  currentSummary,
  isEditing,
  isEditingSecond,
  handleGenerate
}: UseKeyboardShortcutsProps): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/editors
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Escape: Close modals/sidebar
      if (e.key === "Escape") {
        if (sidebarOpen) {
          setSidebarOpen(false);
          e.preventDefault();
        } else if (settingsOpen) {
          setSettingsOpen(false);
          e.preventDefault();
        } else if (subjectPickerOpen) {
          setSubjectPickerOpen(false);
          e.preventDefault();
        }
        return;
      }

      // Ctrl/Cmd + G: Generate
      if (modKey && e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        const canGen = fileHandling.extractedText && selectedModel && !generatingTabId;
        if (canGen) {
          void handleGenerate();
        }
        return;
      }

      // Ctrl/Cmd + B: Toggle sidebar
      if (modKey && e.key === "b") {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
        return;
      }

      // Ctrl/Cmd + K: Focus search (if in history)
      if (modKey && e.key === "k") {
        e.preventDefault();
        if (sidebarOpen) {
          // Focus search input in history sidebar
          const searchInput = document.querySelector<HTMLInputElement>(".history-search-input");
          searchInput?.focus();
        }
        return;
      }

      // Ctrl/Cmd + C: Copy summary (when preview is visible)
      if (modKey && e.key === "c" && !e.shiftKey) {
        if (currentSummary && !isEditing && !isEditingSecond) {
          e.preventDefault();
          // Copy to clipboard
          navigator.clipboard.writeText(currentSummary).catch(() => {
            // Fallback if clipboard API fails
          });
        }
        return;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, settingsOpen, subjectPickerOpen, fileHandling.extractedText, selectedModel, generatingTabId, currentSummary, isEditing, isEditingSecond, handleGenerate, setSidebarOpen, setSettingsOpen, setSubjectPickerOpen]);
}
