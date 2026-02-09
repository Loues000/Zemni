import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useHistory } from "@/hooks/useHistory";
import type { HistoryEntry } from "@/types";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock convex/react
const mockUpsertDocument = vi.fn();
const mockRemoveDocument = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (mutation: any) => {
    if (mutation?.toString?.().includes("upsert")) {
      return mockUpsertDocument;
    }
    if (mutation?.toString?.().includes("remove")) {
      return mockRemoveDocument;
    }
    return vi.fn();
  },
}));

// Mock convex api
vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getCurrentUser: "users.getCurrentUser" },
    documents: {
      getAll: "documents.getAll",
      upsert: "documents.upsert",
      remove: "documents.remove",
    },
  },
}));

// Mock history storage
vi.mock("@/lib/history-storage", () => ({
  loadHistoryFromStorage: () => [],
  saveHistoryToStorage: () => {},
  documentToHistoryEntry: (doc: any) => ({
    id: doc._id,
    title: doc.title,
    fileName: doc.fileName,
    extractedText: doc.extractedText,
    outputs: doc.outputs || {},
    structureHints: doc.structureHints || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    exportedSubject: doc.exportedSubject,
    notionPageId: doc.notionPageId,
  }),
  historyEntryToDocument: (entry: HistoryEntry, userId: string) => ({
    userId,
    title: entry.title,
    fileName: entry.fileName,
    extractedText: entry.extractedText,
    outputs: entry.outputs,
    structureHints: entry.structureHints,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    exportedSubject: entry.exportedSubject,
    notionPageId: entry.notionPageId,
  }),
  sortHistory: (entries: HistoryEntry[]) => 
    [...entries].sort((a, b) => b.updatedAt - a.updatedAt),
}));

import { toast } from "sonner";

describe("useHistory", () => {
  const mockUser = {
    _id: "k1234567890123456789012345",
    clerkUserId: "user_123",
    email: "test@example.com",
    subscriptionTier: "basic",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockEntry: HistoryEntry = {
    id: "test-entry-123",
    title: "Test Document",
    fileName: "test.pdf",
    extractedText: "Test content",
    outputs: {},
    structureHints: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  let mockDocuments: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDocuments = [];
    // Default: authenticated user with no documents
    mockUseQuery.mockImplementation((query: any) => {
      if (query === "users.getCurrentUser") return mockUser;
      if (query === "documents.getAll") return mockDocuments;
      return undefined;
    });
    mockUpsertDocument.mockResolvedValue("k1234567890123456789012346");
    mockRemoveDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Initial State", () => {
    it("should initialize with empty history for authenticated user", async () => {
      const { result } = renderHook(() => useHistory());
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.history).toEqual([]);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.saveError).toBeNull();
      expect(result.current.lastSavedAt).toBeNull();
    });

    it("should initialize with localStorage fallback for unauthenticated user", async () => {
      mockUseQuery.mockImplementation((query: any) => {
        if (query === "users.getCurrentUser") return null;
        if (query === "documents.getAll") return undefined;
        return undefined;
      });

      const { result } = renderHook(() => useHistory());
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.history).toEqual([]);
    });
  });

  describe("saveEntryToConvex", () => {
    it("should save document to Convex successfully", async () => {
      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const promise = result.current.saveEntryToConvex(mockEntry);
        await vi.runAllTimersAsync();
        const returnedId = await promise;
        expect(returnedId).toBe("k1234567890123456789012346");
      });

      expect(mockUpsertDocument).toHaveBeenCalledWith({
        title: mockEntry.title,
        fileName: mockEntry.fileName,
        extractedText: mockEntry.extractedText,
        outputs: mockEntry.outputs,
        structureHints: mockEntry.structureHints,
      });
      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });

    it("should update lastSavedAt on successful save", async () => {
      const { result } = renderHook(() => useHistory());
      const beforeSave = Date.now();

      await act(async () => {
        const promise = result.current.saveEntryToConvex(mockEntry);
        await vi.runAllTimersAsync();
        await promise;
      });

      const afterSave = Date.now();
      expect(result.current.lastSavedAt?.getTime()).toBeGreaterThanOrEqual(beforeSave);
      expect(result.current.lastSavedAt?.getTime()).toBeLessThanOrEqual(afterSave);
    });

    it("should not pass documentId (upsert dedup handles identity)", async () => {
      const entryWithConvexId: HistoryEntry = {
        ...mockEntry,
        id: "k1234567890123456789012347",
      };

      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const promise = result.current.saveEntryToConvex(entryWithConvexId);
        await vi.runAllTimersAsync();
        await promise;
      });

      const [firstCallArgs] = mockUpsertDocument.mock.calls[0] || [];
      expect(firstCallArgs).toBeTruthy();
      expect(firstCallArgs).not.toHaveProperty("documentId");
    });

    it("should throw error when user is not authenticated", async () => {
      mockUseQuery.mockImplementation((query: any) => {
        if (query === "users.getCurrentUser") return null;
        if (query === "documents.getAll") return undefined;
        return undefined;
      });

      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const promise = result.current.saveEntryToConvex(mockEntry);
        const assertion = expect(promise).rejects.toThrow("Not authenticated");
        await vi.runAllTimersAsync();
        await assertion;
      });
    });
  });

  describe("Retry Logic", () => {
    it("should retry on failure and succeed", async () => {
      mockUpsertDocument
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("k1234567890123456789012346");

      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const promise = result.current.saveEntryToConvex(mockEntry);
        await vi.runAllTimersAsync();
        const returnedId = await promise;
        expect(returnedId).toBe("k1234567890123456789012346");
      });

      expect(mockUpsertDocument).toHaveBeenCalledTimes(3);
    });

    it("should show toast error after max retries exceeded", async () => {
      mockUpsertDocument.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const handled = result.current
          .saveEntryToConvex(mockEntry)
          .catch(() => undefined);
        await vi.runAllTimersAsync();
        await handled;
      });

      expect(mockUpsertDocument).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(toast.error).toHaveBeenCalledWith("Failed to save document", expect.any(Object));
      expect(result.current.saveError).toBe("Network error");
    });

    it("should track failed entries for manual retry", async () => {
      mockUpsertDocument.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const handled = result.current
          .saveEntryToConvex(mockEntry)
          .catch(() => undefined);
        await vi.runAllTimersAsync();
        await handled;
      });

      // Failed entry should be tracked
      await act(async () => {
        const promise = result.current.retryFailedSaves();
        await vi.runAllTimersAsync();
        await promise;
      });

      // Should attempt to retry (but will fail again in this test)
      expect(mockUpsertDocument).toHaveBeenCalledTimes(8); // 4 initial + 4 retry
    });
  });

  describe("saveAllEntriesToConvex", () => {
    it("should save multiple entries sequentially", async () => {
      const entries: HistoryEntry[] = [
        { ...mockEntry, id: "entry-1" },
        { ...mockEntry, id: "entry-2" },
        { ...mockEntry, id: "entry-3" },
      ];

      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const promise = result.current.saveAllEntriesToConvex(entries);
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(mockUpsertDocument).toHaveBeenCalledTimes(3);
      expect(result.current.pendingSaves).toBe(0);
      expect(result.current.isSaving).toBe(false);
    });

    it("should handle batch save errors gracefully", async () => {
      const entries: HistoryEntry[] = [
        { ...mockEntry, id: "entry-1" },
        { ...mockEntry, id: "entry-2" },
      ];

      mockUpsertDocument
        .mockResolvedValueOnce("id-1")
        .mockRejectedValue(new Error("Save failed"));

      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const promise = result.current.saveAllEntriesToConvex(entries);
        await vi.runAllTimersAsync();
        await promise;
      });

      // Should have attempted 3 retries for the failed one
      // Total: 1 success (entry-1) + 1 initial failure (entry-2) + 3 retries (entry-2) = 5 calls
      expect(mockUpsertDocument).toHaveBeenCalledTimes(5);
    });
  });

  describe("retryFailedSaves", () => {
    it("should show info toast when no failed saves exist", async () => {
      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const promise = result.current.retryFailedSaves();
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(toast.info).toHaveBeenCalledWith("No failed saves to retry");
    });

    it("should show success toast when all retries succeed", async () => {
      const { result } = renderHook(() => useHistory());

      // First save fails
      mockUpsertDocument.mockRejectedValue(new Error("Network error"));
      
      await act(async () => {
        const handled = result.current
          .saveEntryToConvex(mockEntry)
          .catch(() => undefined);
        await vi.runAllTimersAsync();
        await handled;
      });

      // Then retry succeeds
      mockUpsertDocument.mockResolvedValueOnce("success-id");
      vi.clearAllMocks();

      await act(async () => {
        const promise = result.current.retryFailedSaves();
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Successfully saved"));
    });

    it("should show warning toast when partial retry succeeds", async () => {
      const { result } = renderHook(() => useHistory());
      const entries: HistoryEntry[] = [
        { ...mockEntry, id: "entry-1" },
        { ...mockEntry, id: "entry-2" },
      ];

      // Both fail initially
      mockUpsertDocument.mockRejectedValue(new Error("Network error"));
      
      for (const entry of entries) {
        await act(async () => {
          const handled = result.current
            .saveEntryToConvex(entry)
            .catch(() => undefined);
          await vi.runAllTimersAsync();
          await handled;
        });
      }

      // One succeeds on retry, one fails
      mockUpsertDocument
        .mockResolvedValueOnce("success-1")
        .mockRejectedValue(new Error("Still failing"));
      
      vi.clearAllMocks();

      await act(async () => {
        const promise = result.current.retryFailedSaves();
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("Saved"));
    });
  });

  describe("clearSaveError", () => {
    it("should clear save error", async () => {
      mockUpsertDocument.mockRejectedValue(new Error("Save failed"));
      const { result } = renderHook(() => useHistory());

      await act(async () => {
        const handled = result.current
          .saveEntryToConvex(mockEntry)
          .catch(() => undefined);
        await vi.runAllTimersAsync();
        await handled;
      });

      expect(result.current.saveError).toBe("Save failed");

      act(() => {
        result.current.clearSaveError();
      });

      expect(result.current.saveError).toBeNull();
    });
  });
});
