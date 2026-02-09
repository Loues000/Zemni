"use client";

import { useEffect, useMemo, useRef, useState, lazy, Suspense, useCallback } from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  HistorySidebar,
  InputPanel,
  OutputTabs,
  RefineBar,
  FlashcardsDensityControl,
  SubjectPickerModal,
  DeleteOutputModal,
  ModeSwitch,
  type FlashcardsDensity
} from "@/components/features";

// Lazy load heavy components for better performance
const SummaryPreview = lazy(() => import("@/components/features/SummaryPreview.tsx").then(m => ({ default: m.SummaryPreview })));
const FlashcardsMode = lazy(() => import("@/components/features/FlashcardsMode.tsx").then(m => ({ default: m.FlashcardsMode })));
const QuizMode = lazy(() => import("@/components/features/QuizMode.tsx").then(m => ({ default: m.QuizMode })));
import { ActivityBar, CostPreview, StatsSection, IconMenu, IconSun, IconMoon, IconSettings, LoginPromptBanner } from "@/components/ui";

import { ClerkSignedIn, ClerkSignedOut, ClerkSignInButton } from "@/components/auth/ClerkWrapper";
import { UserButton, useUser } from "@clerk/nextjs";
import type { OutputKind, UsageStats, HistoryEntry, Status } from "@/types";
import {
  useHistory,
  useTokenEstimate,
  useAppState,
  useOutputManagement,
  useFileHandling,
  useGeneration,
  useExport,
  useQuizState,
  useEditing,
  useHistoryManagement,
  useKeyboardShortcuts,
  useUIState,
  useComputedValues,
  useRefineEffects,
  useSessionPersistence,
  useClientRateLimit
} from "@/hooks";
import { enforceOutputFormat } from "@/lib/format-output";
import { getSummaryTitle } from "@/lib/output-previews";
import { estimateFlashcardsPerSection, estimateQuizQuestions } from "@/lib/study-heuristics";
import { formatErrorMessage } from "@/lib/utils/error-messages";
import { handleTabChange, handleCloseTabRequest, handleCloseTabConfirm, type TabHandlersContext } from "@/lib/handlers/tab-handlers";
import { handleRefineSubmit, handleCopySummary, handleCopySummarySecond, handleEditStart, handleEditSave, handleEditStartSecond, handleEditSaveSecond, type SummaryHandlersContext } from "@/lib/handlers/summary-handlers";
import { createSummaryContext } from "@/lib/handlers/summary-context";
import { useSummaryWrappers } from "@/lib/handlers/summary-wrappers";
import { handleRetryGeneration } from "@/lib/handlers/retry-handlers";

/**
 * Root client component wiring global app state and layout.
 */
export default function AppClient() {
  const router = useRouter();
  // Core app state
  const appState = useAppState();
  const {
    theme,
    setTheme,
    models,
    subjects,
    selectedModel,
    setSelectedModel,
    selectedSubject,
    setSelectedSubject,
    structureHints,
    setStructureHints,
    status,
    setStatus,
    error,
    setError,
    isCoarsePointer,
    isSmallScreen,
    statsOpen,
    setStatsOpen,
    defaultStructureHints,
  } = appState;

  // Output kind and editing state
  const [outputKind, setOutputKind] = useState<OutputKind>("summary");
  const [flashcardsDensity, setFlashcardsDensity] = useState<FlashcardsDensity>(2);
  const editing = useEditing();
  const {
    isEditing,
    setIsEditing,
    isEditingSecond,
    setIsEditingSecond,
    editDraft,
    setEditDraft,
    editDraftSecond,
    setEditDraftSecond
  } = editing;

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copySuccessSecond, setCopySuccessSecond] = useState(false);
  const [tabToDelete, setTabToDelete] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"input" | "output">("input");

  // User and subscription state
  const { user: clerkUser } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const subscriptionTier = currentUser?.subscriptionTier || "free";
  const preferredName = currentUser?.preferredName || clerkUser?.fullName || null;
  const useOwnKeyPreference = useQuery(api.apiKeys.getUseOwnKeyPreference);
  
  // Nerd stats preference from localStorage
  const [showNerdStats, setShowNerdStats] = useState(false);
  
  // Load nerd stats preference from localStorage on mount and listen for changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("showNerdStats");
      setShowNerdStats(saved === "true");
      
      // Listen for storage events to sync across tabs
      /**
       * Sync nerd stats preference between tabs via localStorage events.
       */
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === "showNerdStats") {
          setShowNerdStats(e.newValue === "true");
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    }
  }, []);

  // Login prompt state - show when file is uploaded or generation starts
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Refs
  const previewRef1 = useRef<HTMLDivElement | null>(null);
  const previewRef2 = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef<boolean>(false);
  const refineTargetRef = useRef<string>("");
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);

  // History and token estimation
  const { 
    history, 
    updateHistoryState, 
    isSaving, 
    saveError, 
    lastSavedAt, 
    pendingSaves,
    saveEntryToConvex,
    clearSaveError,
    retryFailedSaves 
  } = useHistory();
  const {
    modelCosts,
    costHeuristic,
    isEstimating,
    fetchTokenEstimate,
    setModelCosts,
    setCostHeuristic
  } = useTokenEstimate();

  // Output management
  const outputManagement = useOutputManagement(outputKind, setIsEditing, setIsEditingSecond);
  const {
    outputs,
    setOutputs,
    selectedTabId,
    setSelectedTabId,
    secondTabId,
    setSecondTabId,
    generatingTabId,
    setGeneratingTabId,
    outputsForModeRecord,
    currentOutput,
    secondOutput,
    isSplitView
  } = outputManagement;

  // Chat/refine - need to create this first for file handling
  const chatConfig = useChat({
    api: "/api/refine",
    onFinish: (message) => {
      const targetTabId = refineTargetRef.current;
      const content = message?.content || "";
      if (targetTabId && content) {
        const formattedContent = enforceOutputFormat(content);
        setOutputs((prev) => {
          const existing = prev[targetTabId];
          if (!existing) return prev;
          return {
            ...prev,
            [targetTabId]: {
              ...existing,
              summary: formattedContent,
              updatedAt: Date.now()
            }
          };
        });
      }
      setStatus("ready");
    },
    onError: (chatError: Error) => {
      setError(formatErrorMessage(chatError));
      setStatus("error");
    }
  });

  const setMessages = chatConfig.setMessages;
  const setInput = chatConfig.setInput;
  const setData = chatConfig.setData;

  // Temporary state for export (to avoid circular dependency)
  const [tempLastExportedPageId, setTempLastExportedPageId] = useState<string | null>(null);
  const [tempExportProgress, setTempExportProgress] = useState<{ current: number; total: number } | null>(null);

  // File handling
  const fileHandling = useFileHandling(
    setStatus,
    setError,
    setOutputs,
    setSelectedTabId,
    setSecondTabId,
    setGeneratingTabId,
    setLoadedFromHistory,
    setCurrentHistoryId,
    setMessages,
    setInput,
    setData,
    setIsEditing,
    setIsEditingSecond,
    setTempLastExportedPageId,
    setTempExportProgress,
    refineTargetRef,
    setMobileView
  );

  // Show login prompt when file is uploaded or generation starts (for unauthenticated users)
  useEffect(() => {
    if (currentUser !== undefined && !currentUser) {
      // User is not authenticated
      if (fileHandling.extractedText || status === "summarizing") {
        setShowLoginPrompt(true);
      }
    } else if (currentUser) {
      // User is authenticated, hide prompt
      setShowLoginPrompt(false);
    }
  }, [fileHandling.extractedText, status, currentUser]);

  // Generation
  const generation = useGeneration(
    fileHandling.fileName,
    fileHandling.extractedText,
    outputKind,
    selectedModel,
    models,
    structureHints,
    flashcardsDensity,
    isSmallScreen,
    selectedTabId,
    setOutputs,
    setSelectedTabId,
    setGeneratingTabId,
    setError,
    setStatus,
    setMobileView,
    setLoadedFromHistory,
    setIsEditing,
    setData,
    setMessages,
    setInput
  );
  const { docSection, studySection, textForEstimate, handleGenerate, handleRetry } = generation;

  // Client-side rate limiting for better UX (prevents double-clicks, reduces network traffic)
  const rateLimitedGenerate = useClientRateLimit({
    fn: handleGenerate,
    minInterval: 2000 // 2 seconds minimum between requests
  });

  // Export
  const exportHook = useExport(
    outputKind,
    currentOutput?.summary ?? "",
    fileHandling.fileName,
    selectedSubject,
    subjects,
    fileHandling.extractedText,
    outputs,
    structureHints,
    currentHistoryId,
    setError,
    setStatus,
    setSelectedSubject,
    setLoadedFromHistory,
    updateHistoryState
  );
  const {
    exportProgress,
    lastExportedPageId,
    subjectPickerOpen,
    setSubjectPickerOpen,
    pendingExport,
    handleExport,
    handleSubjectPicked
  } = exportHook;

  // Sync temp state with export hook
  useEffect(() => {
    exportHook.setLastExportedPageId(tempLastExportedPageId);
  }, [tempLastExportedPageId, exportHook]);
  useEffect(() => {
    exportHook.setExportProgress(tempExportProgress);
  }, [tempExportProgress, exportHook]);

  // History management
  const { saveToHistory, loadFromHistory, deleteHistoryEntry } = useHistoryManagement({
    fileHandling,
    outputs,
    structureHints,
    currentHistoryId,
    setCurrentHistoryId,
    setOutputs,
    setStructureHints,
    setLoadedFromHistory,
    setError,
    setSidebarOpen,
    isSmallScreen,
    setMobileView,
    setIsEditing,
    setIsEditingSecond,
    setSecondTabId,
    setSelectedTabId,
    setSelectedModel,
    exportHook,
    setMessages,
    setInput,
    setData,
    updateHistoryState,
    saveEntryToConvex,
    setSaveError: (err) => {
      if (err) console.error("[App] Save error:", err);
    },
    currentUser // Pass currentUser so saves can be queued until user is ready
  });

  // Quiz state
  const quizState = useQuizState(
    selectedTabId,
    outputs,
    fileHandling.fileName,
    fileHandling.extractedText,
    generation.studySection,
    setOutputs,
    setError,
    setStatus,
    setGeneratingTabId
  );
  const { handleQuizReveal, handleQuizSelectOption, handleQuizNext, handleQuizPrev } = quizState;

  // Session persistence - restore state when returning from settings
  const sessionPersistence = useSessionPersistence(
    outputs,
    selectedTabId,
    secondTabId,
    outputKind,
    fileHandling.extractedText,
    fileHandling.fileName,
    generatingTabId,
    !loadedFromHistory // Don't persist when loading from history
  );
  const { restoreSession, clearSession } = sessionPersistence;

  // Restore session state on mount (only if not loading from history and coming from settings)
  useEffect(() => {
    if (loadedFromHistory) {
      // If loading from history, clear any session state
      clearSession();
      return;
    }

    // Only restore if we're coming back from settings
    // Check for the flag that indicates we navigated to settings
    if (typeof window !== "undefined") {
      const comingFromSettings = window.sessionStorage.getItem("zemni_came_from_settings");
      if (!comingFromSettings) {
        // Not coming from settings, don't restore session
        // Clear any stale session data
        clearSession();
        return;
      }
      // Clear the flag after checking
      window.sessionStorage.removeItem("zemni_came_from_settings");
    }

    // Only restore if we don't have any current state
    // This prevents overwriting state that was set during initialization
    if (Object.keys(outputs).length > 0 || fileHandling.extractedText) {
      return;
    }

    const restored = restoreSession();
    if (!restored) {
      return;
    }

    // Check if restored file matches current file (if any)
    const fileMatches = !fileHandling.fileName || fileHandling.fileName === restored.fileName;
    
    if (!fileMatches) {
      // Different file, don't restore
      clearSession();
      return;
    }

    // Restore file content if available
    if (restored.extractedText && restored.fileName) {
      fileHandling.setExtractedText(restored.extractedText);
      fileHandling.setFileName(restored.fileName);
    }
    
    // Restore outputs if they exist
    if (Object.keys(restored.outputs).length > 0) {
      setOutputs(restored.outputs);
    }
    
    // Restore tab selection if valid
    if (restored.selectedTabId && restored.outputs[restored.selectedTabId]) {
      setSelectedTabId(restored.selectedTabId);
    }
    
    if (restored.secondTabId && restored.outputs[restored.secondTabId]) {
      setSecondTabId(restored.secondTabId);
    }
    
    // Restore output kind
    if (restored.outputKind && ["summary", "flashcards", "quiz"].includes(restored.outputKind)) {
      setOutputKind(restored.outputKind);
    }
    
    // Handle generation state
    if (restored.generatingTabId) {
      const output = restored.outputs[restored.generatingTabId];
      
      // Check if generation completed while away by examining the restored output
      // We use restored.outputs here because the current outputs state is still being restored
      const hasNewContent = output && (
        (output.summary && output.summary.trim().length > 0) ||
        (output.flashcards && output.flashcards.length > 0) ||
        (output.quiz && output.quiz.length > 0)
      );
      
      if (hasNewContent && output && !output.isGenerating) {
        // Generation completed before navigating to settings
        setGeneratingTabId(null);
        setStatus("ready");
      } else if (output && output.isGenerating && !output.error) {
        // Check if it has content (might have completed but state wasn't updated)
        const hasContent = (output.summary && output.summary.trim().length > 0) ||
                          (output.flashcards && output.flashcards.length > 0) ||
                          (output.quiz && output.quiz.length > 0);
        
        if (hasContent) {
          // Generation completed while in settings, update state
          setOutputs((prev) => ({
            ...prev,
            [restored.generatingTabId!]: {
              ...output,
              isGenerating: false
            }
          }));
          setGeneratingTabId(null);
          setStatus("ready");
        } else {
          // Still generating - restore the state
          // Check if it's been generating for too long (might have failed silently)
          const generatingDuration = Date.now() - (output.updatedAt || Date.now());
          if (generatingDuration > 300_000) {
            // Been generating for more than 5 minutes, likely failed
            // Mark as error so user can retry
            setOutputs((prev) => ({
              ...prev,
              [restored.generatingTabId!]: {
                ...output,
                isGenerating: false,
                error: "Generation may have timed out. Please try again.",
                canRetry: true
              }
            }));
            setGeneratingTabId(null);
            setStatus("error");
          } else {
            // Restore generation state - API call is still running
            setGeneratingTabId(restored.generatingTabId);
            // Restore status from session or default to "summarizing"
            // Note: Status type only includes "summarizing", not "generating-flashcards" or "generating-quiz"
            if (restored.status && ["summarizing", "parsing", "refining"].includes(restored.status)) {
              setStatus(restored.status as Status);
            } else {
              setStatus("summarizing");
            }
          }
        }
      } else {
        // No longer generating
        setGeneratingTabId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Clear session when a new document is uploaded (different from current)
  useEffect(() => {
    if (fileHandling.extractedText && fileHandling.fileName) {
      const restored = restoreSession();
      if (restored && restored.fileName && restored.fileName !== fileHandling.fileName) {
        // New document uploaded, clear old session
        clearSession();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileHandling.fileName]);

  // Computed values
  const { streamingRefineContent, currentCost, currentKind, isCurrentTabRefining, currentSummary, currentUsage, secondSummary } = useComputedValues({
    chatConfig,
    modelCosts,
    selectedModel,
    currentOutput,
    secondOutput,
    selectedTabId,
    refineTargetRef,
    setOutputs
  });

  // Effects
  // Initialize structure hints from defaults
  useEffect(() => {
    if (!structureHints && defaultStructureHints) {
      setStructureHints(defaultStructureHints);
    }
  }, [defaultStructureHints]); // Only run once on mount

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (sidebarOpen || subjectPickerOpen || tabToDelete) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen, subjectPickerOpen, tabToDelete]);

  useEffect(() => {
    if (!settingsOpen) return;

    /**
     * Close settings when clicking outside the settings menu and button.
     */
    const onPointerDown = (e: PointerEvent) => {
      const menu = settingsMenuRef.current;
      const button = settingsButtonRef.current;
      if (!menu || !button) return;
      if (menu.contains(e.target as Node) || button.contains(e.target as Node)) {
        return;
      }
      setSettingsOpen(false);
    };

    /**
     * Close settings when Escape is pressed.
     */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  // Refine effects
  useRefineEffects({
    chatConfig,
    refineTargetRef,
    setOutputs
  });

  // Hide/show refine float button based on refine bar visibility
  useEffect(() => {
    if (!isSmallScreen || !currentSummary) return;

    const refineBar = document.querySelector('.refine-bar') as HTMLElement;
    const floatBtn = document.querySelector('.refine-float-btn') as HTMLElement;
    if (!refineBar || !floatBtn) return;

    /**
     * Sync refine floating button visibility with refine bar state.
     */
    const updateFloatButton = () => {
      const isHidden = refineBar.classList.contains('refine-bar-hidden');
      floatBtn.style.display = isHidden ? 'flex' : 'none';
    };

    // Initial state
    updateFloatButton();

    // Watch for class changes
    const observer = new MutationObserver(updateFloatButton);
    observer.observe(refineBar, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [isSmallScreen, currentSummary]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
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
  });

  useEffect(() => {
    if (!textForEstimate) {
      setModelCosts([]);
      setCostHeuristic(null);
      return;
    }

    const timer = setTimeout(() => {
      const n = outputKind === "flashcards"
        ? estimateFlashcardsPerSection(textForEstimate.length, flashcardsDensity)
        : outputKind === "quiz"
          ? Math.min(12, estimateQuizQuestions(textForEstimate.length))
          : undefined;
      fetchTokenEstimate(textForEstimate, structureHints, {
        mode: outputKind,
        n,
        sectionsCount: outputKind === "summary" ? undefined : 1
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [textForEstimate, structureHints, outputKind, flashcardsDensity, fetchTokenEstimate, setModelCosts, setCostHeuristic]);

  useEffect(() => {
    // Save to history when:
    // 1. Status is ready and we have outputs
    // 2. Either we're not loading from history (new document) OR we have a currentHistoryId (updating existing document)
    if (status === "ready" && Object.keys(outputs).length > 0 && fileHandling.extractedText && !generatingTabId && (!loadedFromHistory || currentHistoryId)) {
      const timeoutId = setTimeout(() => {
        saveToHistory();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [outputs, status, fileHandling.extractedText, generatingTabId, loadedFromHistory, currentHistoryId, saveToHistory]);

  // Handlers
  const handleModelChange = useCallback((modelId: string): void => {
    setSelectedModel(modelId);
  }, [setSelectedModel]);

  // Navigate to settings and set flag to restore session on return
  const navigateToSettings = useCallback((path: string = "/settings") => {
    if (typeof window !== "undefined") {
      // Set flag to indicate we're navigating to settings
      // This allows session restoration when coming back
      window.sessionStorage.setItem("zemni_came_from_settings", "true");
    }
    router.push(path);
  }, [router]);

  // Memoize sorted output tabs to avoid recalculation
  const outputTabs = useMemo(() => {
    return Object.values(outputs).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [outputs]);

  const tabContext: TabHandlersContext = useMemo(() => ({
    outputKind,
    selectedTabId,
    secondTabId,
    outputs,
    outputTabs,
    setSelectedTabId,
    setSecondTabId,
    setSelectedModel,
    setIsEditing,
    setIsEditingSecond,
    setError,
    setMessages,
    setInput,
    setData,
    generatingTabId,
    setTabToDelete,
    setOutputs
  }), [outputKind, selectedTabId, secondTabId, outputs, outputTabs, setSelectedTabId, setSecondTabId, setSelectedModel, setIsEditing, setIsEditingSecond, setError, setMessages, setInput, setData, generatingTabId, setTabToDelete, setOutputs]);

  const handleTabChangeWrapper = useCallback((tabId: string, event?: React.MouseEvent): void => {
    handleTabChange(tabId, tabContext, event);
  }, [tabContext]);

  const handleCloseTabRequestWrapper = useCallback((tabId: string, event: React.MouseEvent): void => {
    handleCloseTabRequest(tabId, event, setTabToDelete);
  }, [setTabToDelete]);

  const handleCloseTabConfirmWrapper = useCallback((tabId: string): void => {
    handleCloseTabConfirm(tabId, tabContext);
  }, [tabContext]);

  const summaryContext: SummaryHandlersContext = useMemo(() => createSummaryContext({
    currentKind,
    currentSummary,
    selectedTabId,
    currentOutput,
    isSmallScreen,
    setStatus,
    setMobileView,
    setLoadedFromHistory,
    setIsEditing,
    refineTargetRef,
    setData,
    handleSubmit: chatConfig.handleSubmit,
    setError,
    setCopySuccess,
    editDraft,
    setEditDraft,
    setOutputs,
    secondSummary,
    secondTabId,
    secondOutput,
    setIsEditingSecond,
    editDraftSecond,
    setEditDraftSecond,
    setCopySuccessSecond
  }), [currentKind, currentSummary, selectedTabId, currentOutput, isSmallScreen, setStatus, setMobileView, setLoadedFromHistory, setIsEditing, refineTargetRef, setData, chatConfig.handleSubmit, setError, setCopySuccess, editDraft, setEditDraft, setOutputs, secondSummary, secondTabId, secondOutput, setIsEditingSecond, editDraftSecond, setEditDraftSecond, setCopySuccessSecond]);

  // Summary handler wrappers
  const {
    handleCopySummaryWrapper,
    handleCopySummarySecondWrapper,
    handleEditStartWrapper,
    handleEditSaveWrapper,
    handleEditStartSecondWrapper,
    handleEditSaveSecondWrapper,
    handleRefineSubmitWrapper
  } = useSummaryWrappers(summaryContext);

  // UI computed values
  const { statusClass, statusTitle, isGenerating, canGenerate, canExport, canViewOutput } = useUIState({
    status,
    generatingTabId,
    selectedTabId,
    outputKind,
    currentSummary,
    fileHandling,
    chatConfig,
    selectedModel
  });

  const outputsCount = Object.keys(outputs).length;
  const isBusy = status === "parsing" || status === "summarizing" || status === "exporting";
  const headerCompact = !fileHandling.extractedText && outputsCount === 0 && !isBusy;

  return (
    <div className="app">
      <HistorySidebar
        isOpen={sidebarOpen}
        history={history}
        currentHistoryId={currentHistoryId}
        onClose={() => setSidebarOpen(false)}
        onSelectEntry={loadFromHistory}
        onDeleteEntry={deleteHistoryEntry}
        footer={
          <>
            <ClerkSignedIn>
              <button
                type="button"
                className="sidebar-user-button"
                onClick={() => navigateToSettings("/settings")}
              >
                <UserButton afterSignOutUrl="/" />
                <div className="sidebar-user-info">
                  <span className="sidebar-user-name">{preferredName || "User"}</span>
                  <span className="sidebar-user-tier">{subscriptionTier}</span>
                </div>
              </button>
            </ClerkSignedIn>
            <ClerkSignedOut>
              <ClerkSignInButton mode="modal">
                <button type="button" className="sidebar-user-button">
                  <span className="sidebar-user-avatar">?</span>
                  <span>Login</span>
                </button>
              </ClerkSignInButton>
            </ClerkSignedOut>
          </>
        }
      />

      <div className="main">

        {isSmallScreen && (
          <div className="mobile-header" role="region" aria-label="Header">
            <div className="mobile-header-branding">
              <span className="mobile-header-logo">Zemni</span>
            </div>
            <div className="mobile-header-controls">
              <ModeSwitch outputKind={outputKind} onModeChange={setOutputKind} />
              <div className="view-toggle" role="tablist" aria-label="View">
                <button
                  type="button"
                  className={`view-btn${mobileView === "input" ? " active" : ""}`}
                  onClick={() => setMobileView("input")}
                  aria-selected={mobileView === "input"}
                >
                  Setup
                </button>
                <button
                  type="button"
                  className={`view-btn${mobileView === "output" ? " active" : ""}`}
                  onClick={() => setMobileView("output")}
                  aria-selected={mobileView === "output"}
                >
                  Output
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}
        {showLoginPrompt && <LoginPromptBanner />}
        <SubjectPickerModal
          isOpen={subjectPickerOpen}
          subjects={subjects}
          selectedSubjectId={selectedSubject}
          onSelect={handleSubjectPicked}
          onClose={() => {
            setSubjectPickerOpen(false);
            exportHook.setPendingExport(false);
          }}
        />
        <DeleteOutputModal
          isOpen={tabToDelete !== null}
          outputLabel={tabToDelete ? outputs[tabToDelete]?.label ?? "Output" : "Output"}
          onCancel={() => setTabToDelete(null)}
          onConfirm={() => {
            if (!tabToDelete) return;
            handleCloseTabConfirmWrapper(tabToDelete);
          }}
        />

        <div className={`content${isSmallScreen ? ` content-mobile view-${mobileView}` : ""}`}>
          {!isSmallScreen ? (
            <div className="input-column">
              <div className="zemni-heading">
                <h1>Zemni</h1>
              </div>
              <div className="input-panel-modebar" role="region" aria-label="Output mode">
                <ModeSwitch outputKind={outputKind} onModeChange={setOutputKind} />
              </div>
              <InputPanel
                fileName={fileHandling.fileName}
                selectedModel={selectedModel}
                models={models}
                structureHints={structureHints}
                showStructureHints={outputKind === "summary"}
                dragActive={fileHandling.dragActive}
                topBarLeft={
                  <button
                    type="button"
                    className="input-bar-btn"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Open history"
                    title="History"
                  >
                    <IconMenu />
                    <span className="input-bar-btn-label">History</span>
                  </button>
                }
                topBarRight={
                  <div className={`quick-menu${settingsOpen ? " open" : ""}`} ref={settingsMenuRef}>
                    <button
                      ref={settingsButtonRef}
                      type="button"
                      className="input-bar-btn"
                      onClick={() => setSettingsOpen((prev) => !prev)}
                      aria-label="Open quick settings"
                      aria-expanded={settingsOpen}
                      title="Quick settings"
                    >
                      <IconSettings />
                      <span className="input-bar-btn-label">Settings</span>
                    </button>
                    {settingsOpen && (
                      <div className="quick-menu-dropdown" role="menu" aria-label="Quick settings">
                        <div className="quick-menu-header">
                          <span>Quick Settings</span>
                        </div>
                        <button
                          type="button"
                          className="quick-menu-item"
                          role="menuitem"
                          onClick={() => {
                            setTheme(theme === "dark" ? "light" : "dark");
                          }}
                        >
                          <span className="quick-menu-item-icon">🌓</span>
                          <span>Theme</span>
                          <span className="quick-menu-item-meta">{theme === "dark" ? "Dark" : "Light"}</span>
                        </button>
                        <div className="quick-menu-divider" />
                        <button
                          type="button"
                          className="quick-menu-item"
                          role="menuitem"
                          onClick={() => {
                            setSettingsOpen(false);
                            navigateToSettings("/settings");
                          }}
                        >
                          <span className="quick-menu-item-icon">⚙️</span>
                          <span>All Settings</span>
                          <span className="quick-menu-item-arrow">→</span>
                        </button>
                      </div>
                    )}
                  </div>
                }
                dropzoneCorner={
                  <span
                    className={`status-dot ${statusClass} status-dot-corner`}
                    title={statusTitle}
                    aria-label={statusTitle}
                  />
                }
                onDrop={fileHandling.onDrop}
                onDragOver={fileHandling.onDragOver}
                onDragLeave={fileHandling.onDragLeave}
                onSelectFile={fileHandling.onSelectFile}
                onModelChange={handleModelChange}
                onStructureChange={setStructureHints}
                userTier={subscriptionTier}
              >
                {outputKind === "flashcards" && (
                  <div className="field">
                    <label className="field-label">Flashcards amount</label>
                    <div className="field-inline">
                      <FlashcardsDensityControl
                        value={flashcardsDensity}
                        onChange={setFlashcardsDensity}
                        totalChars={generation.studySection.text.length}
                        disabled={!fileHandling.extractedText || status === "parsing" || status === "summarizing"}
                      />
                    </div>
                  </div>
                )}
                {showNerdStats && (
                  <StatsSection
                    currentUsage={currentUsage}
                    isOpen={statsOpen}
                    onToggle={() => setStatsOpen(!statsOpen)}
                    showCost={useOwnKeyPreference === true}
                  />
                )}
              </InputPanel>
            </div>
          ) : (
            <InputPanel
              fileName={fileHandling.fileName}
              selectedModel={selectedModel}
              models={models}
              structureHints={structureHints}
              showStructureHints={outputKind === "summary"}
              dragActive={fileHandling.dragActive}
              topBarLeft={
                <button
                  type="button"
                  className="sidebar-toggle-input"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label="Open history"
                  title="History"
                >
                  <IconMenu />
                </button>
              }
              topBarRight={
                <div className={`settings-float${settingsOpen ? " open" : ""}`} ref={settingsMenuRef}>
                  <button
                    ref={settingsButtonRef}
                    type="button"
                    className="icon-btn settings-btn"
                    onClick={() => setSettingsOpen((prev) => !prev)}
                    aria-label="Open quick settings"
                    aria-expanded={settingsOpen}
                    title="Quick settings"
                  >
                    <IconSettings />
                  </button>
                  {settingsOpen && (
                    <div className="settings-popover" role="menu" aria-label="Quick settings">
                      <div className="settings-popover-section">Quick settings</div>
                      <button
                        type="button"
                        className="settings-popover-item"
                        role="menuitem"
                        onClick={() => {
                          setTheme(theme === "dark" ? "light" : "dark");
                        }}
                      >
                        <span>Theme</span>
                        <span className="settings-popover-meta">{theme === "dark" ? "Dark" : "Light"}</span>
                      </button>
                      <button
                        type="button"
                        className="settings-popover-item"
                        role="menuitem"
                        onClick={() => {
                          setSettingsOpen(false);
                          navigateToSettings("/settings");
                        }}
                      >
                        <span>Settings</span>
                      </button>
                    </div>
                  )}
                </div>
              }
              dropzoneCorner={
                <span
                  className={`status-dot ${statusClass} status-dot-corner`}
                  title={statusTitle}
                  aria-label={statusTitle}
                />
              }
              onDrop={fileHandling.onDrop}
              onDragOver={fileHandling.onDragOver}
              onDragLeave={fileHandling.onDragLeave}
              onSelectFile={fileHandling.onSelectFile}
              onModelChange={handleModelChange}
              onStructureChange={setStructureHints}
              userTier={subscriptionTier}
            >
              {outputKind === "flashcards" && (
                <div className="field">
                  <label className="field-label">Flashcards amount</label>
                  <div className="field-inline">
                    <FlashcardsDensityControl
                      value={flashcardsDensity}
                      onChange={setFlashcardsDensity}
                      totalChars={generation.studySection.text.length}
                      disabled={!fileHandling.extractedText || status === "parsing" || status === "summarizing"}
                    />
                  </div>
                </div>
              )}
              {showNerdStats && (
                <StatsSection
                  currentUsage={currentUsage}
                  isOpen={statsOpen}
                  onToggle={() => setStatsOpen(!statsOpen)}
                  showCost={useOwnKeyPreference === true}
                />
              )}
              {isSmallScreen && (
                <div className="mobile-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void rateLimitedGenerate.execute()}
                    disabled={!canGenerate || rateLimitedGenerate.isRateLimited || rateLimitedGenerate.isExecuting}
                  >
                    {generatingTabId || rateLimitedGenerate.isExecuting ? "Generating..." : "Generate"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMobileView("output")}
                    disabled={!canViewOutput}
                    aria-label="View generated output"
                  >
                    View output
                  </button>
                </div>
              )}
            </InputPanel>
          )}

          <div className="output-panel">
            <div className="output-header">
              <OutputTabs
                outputs={outputsForModeRecord}
                selectedTabId={selectedTabId}
                secondTabId={secondTabId}
                generatingTabId={generatingTabId}
                showSplitHint={!isCoarsePointer}
                onTabChange={handleTabChangeWrapper}
                onCloseTab={handleCloseTabRequestWrapper}
              />
              <div className="output-actions">
                <div className="desktop-only">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void rateLimitedGenerate.execute()}
                    disabled={!canGenerate || rateLimitedGenerate.isRateLimited || rateLimitedGenerate.isExecuting}
                    aria-label={canGenerate ? "Generate content" : "Cannot generate - missing file or model"}
                    title={!canGenerate && !fileHandling.extractedText ? "Upload a file first" : !canGenerate && !selectedModel ? "Select a model first" : rateLimitedGenerate.isRateLimited ? `Please wait ${rateLimitedGenerate.cooldownRemaining}s` : ""}
                  >
                    {generatingTabId || rateLimitedGenerate.isExecuting ? "Generating..." : "Generate"}
                  </button>
                </div>
                {outputKind === "summary" && (() => {
                  const isNotionConfigured = !!(currentUser?.notionToken && currentUser?.notionDatabaseId);

                  if (!isNotionConfigured) {
                    return (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigateToSettings("/settings?tab=notion")}
                        aria-label="Set up Notion integration"
                        title="Configure Notion integration to export summaries"
                      >
                        Set up Notion
                      </button>
                    );
                  }

                  // Only show export buttons if there's output
                  if (!canExport && !lastExportedPageId) {
                    return null;
                  }

                  return (
                    <>
                      {status === "exporting" ? (
                        <button type="button" className="btn btn-secondary btn-sm" disabled>
                          Exporting...
                        </button>
                      ) : lastExportedPageId ? (
                        <div className="export-actions-group">
                          <a
                            href={`https://notion.so/${lastExportedPageId.replace(/-/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                          >
                            Open in Notion
                          </a>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void handleExport()}
                            disabled={!canExport}
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void handleExport()}
                          disabled={!canExport}
                          aria-label={canExport ? "Export summary to Notion" : "Cannot export - no summary available"}
                          title={!canExport ? "Generate a summary first" : ""}
                        >
                          Export to Notion
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            <ActivityBar 
              status={status} 
              exportProgress={exportProgress} 
              outputKind={outputKind}
              modelId={selectedModel}
              documentSize={fileHandling.extractedText?.length || 0} 
            />

            {outputKind === "summary" ? (
              <Suspense fallback={<div className="preview-empty">Loading preview...</div>}>
                <SummaryPreview
                  isSplitView={isSplitView}
                  selectedTabId={selectedTabId}
                  secondTabId={secondTabId}
                  currentOutput={currentOutput}
                  secondOutput={secondOutput}
                  currentSummary={currentSummary}
                  secondSummary={secondSummary}
                  isEditing={isEditing}
                  isEditingSecond={isEditingSecond}
                  editDraft={editDraft}
                  editDraftSecond={editDraftSecond}
                  previewRef1={previewRef1}
                  previewRef2={previewRef2}
                  isScrolling={isScrolling}
                  copySuccess={copySuccess}
                  copySuccessSecond={copySuccessSecond}
                  onEditStart={handleEditStartWrapper}
                  onEditSave={handleEditSaveWrapper}
                  onEditStartSecond={handleEditStartSecondWrapper}
                  onEditSaveSecond={handleEditSaveSecondWrapper}
                  onEditDraftChange={setEditDraft}
                  onEditDraftChangeSecond={setEditDraftSecond}
                  onCopySummary={handleCopySummaryWrapper}
                  onCopySummarySecond={handleCopySummarySecondWrapper}
                  onSyncScroll={() => { }}
                  onCloseSplit={() => setSecondTabId(null)}
                  onRetry={selectedTabId && currentOutput?.canRetry ? () => handleRetry(selectedTabId, outputs) : undefined}
                  extractedText={fileHandling.extractedText}
                />
              </Suspense>
            ) : outputKind === "flashcards" ? (
              <div className="mode-panel">
                <Suspense fallback={<div className="preview-empty">Loading flashcards...</div>}>
                  <FlashcardsMode
                    extractedText={fileHandling.extractedText}
                    fileName={fileHandling.fileName}
                    output={currentOutput}
                    showKeyboardHints={!isCoarsePointer}
                    onRetry={selectedTabId && currentOutput?.canRetry ? () => handleRetry(selectedTabId, outputs) : undefined}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="mode-panel">
                <Suspense fallback={<div className="preview-empty">Loading quiz...</div>}>
                  <QuizMode
                    extractedText={fileHandling.extractedText}
                    fileName={fileHandling.fileName}
                    output={currentOutput}
                    status={status}
                    onReveal={handleQuizReveal}
                    onNext={handleQuizNext}
                    onSelectOption={handleQuizSelectOption}
                    onPrev={handleQuizPrev}
                    showKeyboardHints={!isCoarsePointer}
                    onRetry={selectedTabId && currentOutput?.canRetry ? () => handleRetry(selectedTabId, outputs) : undefined}
                  />
                </Suspense>
              </div>
            )}

            {outputKind === "summary" && (
              <>
                <RefineBar
                  input={chatConfig.input}
                  isRefining={chatConfig.isLoading}
                  hasCurrentSummary={!!currentSummary}
                  onInputChange={chatConfig.handleInputChange}
                  onSubmit={handleRefineSubmitWrapper}
                  isMobile={isSmallScreen}
                  onClose={isSmallScreen ? () => {
                    const refineBar = document.querySelector('.refine-bar') as HTMLElement;
                    const floatBtn = document.querySelector('.refine-float-btn') as HTMLElement;
                    if (refineBar) {
                      refineBar.classList.add('refine-bar-hidden');
                      if (floatBtn) floatBtn.style.display = 'flex';
                    }
                  } : undefined}
                />
                {isSmallScreen && currentSummary && (
                  <button
                    type="button"
                    className="refine-float-btn mobile-only"
                    onClick={() => {
                      // Toggle refine bar visibility on mobile
                      const refineBar = document.querySelector('.refine-bar') as HTMLElement;
                      if (refineBar) {
                        const isHidden = refineBar.classList.contains('refine-bar-hidden');
                        if (isHidden) {
                          refineBar.classList.remove('refine-bar-hidden');
                          const refineInput = refineBar.querySelector('input') as HTMLInputElement;
                          if (refineInput) {
                            setTimeout(() => {
                              refineInput.focus();
                            }, 100);
                          }
                        } else {
                          refineBar.classList.add('refine-bar-hidden');
                        }
                      }
                    }}
                    aria-label="Request changes"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <path d="M13 8H3" />
                      <path d="M17 12H3" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
