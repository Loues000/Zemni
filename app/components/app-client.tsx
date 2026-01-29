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
import { ActivityBar, CostPreview, StatsSection, IconMenu, IconSun, IconMoon, IconSettings, Footer } from "@/components/ui";
import { ClerkSignedIn, ClerkSignedOut, ClerkSignInButton } from "@/components/auth/ClerkWrapper";
import { UserButton } from "@clerk/nextjs";
import type { OutputKind, UsageStats, HistoryEntry } from "@/types";
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
  useRefineEffects
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
  const currentUser = useQuery(api.users.getCurrentUser);
  const subscriptionTier = currentUser?.subscriptionTier || "free";

  // Refs
  const previewRef1 = useRef<HTMLDivElement | null>(null);
  const previewRef2 = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef<boolean>(false);
  const refineTargetRef = useRef<string>("");
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);

  // History and token estimation
  const { history, updateHistoryState } = useHistory();
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

    const onPointerDown = (e: PointerEvent) => {
      const menu = settingsMenuRef.current;
      const button = settingsButtonRef.current;
      if (!menu || !button) return;
      if (menu.contains(e.target as Node) || button.contains(e.target as Node)) {
        return;
      }
      setSettingsOpen(false);
    };

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
    if (status === "ready" && Object.keys(outputs).length > 0 && fileHandling.extractedText && !generatingTabId && !loadedFromHistory) {
      saveToHistory();
    }
  }, [outputs, status, fileHandling.extractedText, generatingTabId, loadedFromHistory]);

  // Handlers
  const handleModelChange = useCallback((modelId: string): void => {
    setSelectedModel(modelId);
  }, [setSelectedModel]);

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
    updateHistoryState
  });

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
                onClick={() => router.push("/settings")}
              >
                <UserButton afterSignOutUrl="/" />
                <span>Settings</span>
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
                  router.push("/settings");
                }}
              >
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>

        {isSmallScreen && (
          <div className="top-toolbar" role="region" aria-label="Controls">
            <div className="top-toolbar-left">
              <ModeSwitch outputKind={outputKind} onModeChange={setOutputKind} />
            </div>
            <div className="top-toolbar-right">
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
                    className="sidebar-toggle-input"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Open history"
                    title="History"
                  >
                    <IconMenu />
                  </button>
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
                <CostPreview
                  currentCost={currentCost}
                  isEstimating={isEstimating}
                  costHeuristic={costHeuristic}
                  defaultCollapsed={isCoarsePointer}
                />
                <StatsSection
                  currentUsage={currentUsage}
                  isOpen={statsOpen}
                  onToggle={() => setStatsOpen(!statsOpen)}
                />
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
              <CostPreview
                currentCost={currentCost}
                isEstimating={isEstimating}
                costHeuristic={costHeuristic}
                defaultCollapsed={isCoarsePointer}
              />
              <StatsSection
                currentUsage={currentUsage}
                isOpen={statsOpen}
                onToggle={() => setStatsOpen(!statsOpen)}
              />
              {isSmallScreen && (
                <div className="mobile-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleGenerate()}
                    disabled={!canGenerate}
                  >
                    {generatingTabId ? "Generating..." : "Generate"}
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
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  aria-label={canGenerate ? "Generate content" : "Cannot generate - missing file or model"}
                  title={!canGenerate && !fileHandling.extractedText ? "Upload a file first" : !canGenerate && !selectedModel ? "Select a model first" : ""}
                >
                  {generatingTabId ? "Generating..." : "Generate"}
                </button>
                {outputKind === "summary" && (
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
                )}
              </div>
            </div>
            <ActivityBar status={status} exportProgress={exportProgress} />

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
              <RefineBar
                input={chatConfig.input}
                isRefining={chatConfig.isLoading}
                hasCurrentSummary={!!currentSummary}
                onInputChange={chatConfig.handleInputChange}
                onSubmit={handleRefineSubmitWrapper}
              />
            )}
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
