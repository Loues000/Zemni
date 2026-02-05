import { useEffect, useRef } from "react";
import type { OutputEntry, OutputKind } from "@/types";

const SESSION_STORAGE_KEY = "zemni_session_state";

export interface SessionState {
  outputs: Record<string, OutputEntry>;
  selectedTabId: string | null;
  secondTabId: string | null;
  outputKind: OutputKind;
  extractedText: string;
  fileName: string;
  generatingTabId: string | null;
  status?: string; // Generation status: "summarizing", "generating-flashcards", "generating-quiz", "ready", "error"
}

export interface UseSessionPersistenceReturn {
  restoreSession: () => SessionState | null;
  clearSession: () => void;
  isRestored: boolean;
}

/**
 * Persist and restore UI session state (tabs, outputs, extracted text, and related metadata) to sessionStorage.
 *
 * Persists changes to sessionStorage (with size-aware truncation and fallback) and provides functions to restore or clear the saved session.
 *
 * @param shouldPersist - When false, prevents saving session state to sessionStorage
 * @param status - Optional status string to include in the persisted session
 * @returns An object with:
 *  - `restoreSession`: a function that returns the persisted SessionState or `null` if none or already restored,
 *  - `clearSession`: a function that removes any saved session,
 *  - `isRestored`: a boolean indicating whether a session has been restored
 */
export function useSessionPersistence(
  outputs: Record<string, OutputEntry>,
  selectedTabId: string | null,
  secondTabId: string | null,
  outputKind: OutputKind,
  extractedText: string,
  fileName: string,
  generatingTabId: string | null,
  shouldPersist: boolean = true,
  status?: string // Optional status to persist
): UseSessionPersistenceReturn {
  const isRestoredRef = useRef(false);
  const isInitialMount = useRef(true);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    // Don't save on initial mount (before restore)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Don't save if we shouldn't persist (e.g., when loading from history)
    if (!shouldPersist) {
      return;
    }

    // Don't save if there's no meaningful state to save
    if (!extractedText && Object.keys(outputs).length === 0) {
      return;
    }

    try {
      const sessionState: SessionState = {
        outputs,
        selectedTabId,
        secondTabId,
        outputKind,
        extractedText,
        fileName,
        generatingTabId,
        status
      };

      // Check size before saving (sessionStorage has ~5-10MB limit)
      const serialized = JSON.stringify(sessionState);
      if (serialized.length > 4_000_000) {
        // If too large, only save essential state (without full outputs)
        const minimalState: SessionState = {
          outputs: {}, // Don't save outputs if too large
          selectedTabId,
          secondTabId,
          outputKind,
          extractedText: extractedText.slice(0, 1000), // Truncate text
          fileName,
          generatingTabId,
          status
        };
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(minimalState));
        console.warn("[SessionPersistence] State too large, saving minimal state");
      } else {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
      }
    } catch (err) {
      // Handle quota exceeded or other errors gracefully
      console.error("[SessionPersistence] Failed to save state:", err);
      try {
        // Try saving minimal state as fallback
        const minimalState: SessionState = {
          outputs: {},
          selectedTabId,
          secondTabId,
          outputKind,
          extractedText: extractedText.slice(0, 1000),
          fileName,
          generatingTabId,
          status
        };
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(minimalState));
      } catch (fallbackErr) {
        console.error("[SessionPersistence] Failed to save minimal state:", fallbackErr);
      }
    }
  }, [outputs, selectedTabId, secondTabId, outputKind, extractedText, fileName, generatingTabId, shouldPersist, status]);

  // Restore session state on mount (only once)
  const restoreSession = (): SessionState | null => {
    if (isRestoredRef.current) {
      return null; // Already restored
    }

    try {
      const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) {
        return null;
      }

      const parsed = JSON.parse(saved) as SessionState;
      
      // Validate structure
      if (
        typeof parsed !== "object" ||
        !("outputs" in parsed) ||
        !("selectedTabId" in parsed) ||
        !("secondTabId" in parsed) ||
        !("outputKind" in parsed) ||
        !("extractedText" in parsed) ||
        !("fileName" in parsed) ||
        !("generatingTabId" in parsed)
      ) {
        console.warn("[SessionPersistence] Invalid session state structure");
        return null;
      }

      isRestoredRef.current = true;
      return parsed;
    } catch (err) {
      console.error("[SessionPersistence] Failed to restore session:", err);
      // Clear corrupted data
      try {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Ignore
      }
      return null;
    }
  };

  const clearSession = () => {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      isRestoredRef.current = false;
    } catch (err) {
      console.error("[SessionPersistence] Failed to clear session:", err);
    }
  };

  return {
    restoreSession,
    clearSession,
    isRestored: isRestoredRef.current
  };
}