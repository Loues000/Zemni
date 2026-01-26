"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import { 
  HistorySidebar, 
  InputPanel, 
  OutputTabs, 
  SummaryPreview, 
  RefineBar,
  FlashcardsMode,
  QuizMode,
  FlashcardsDensityControl,
  SubjectPickerModal,
  DeleteOutputModal,
  type FlashcardsDensity
} from "@/components/features";
import { ActivityBar, CostPreview, StatsSection, IconMenu, IconSun, IconMoon, Footer } from "@/components/ui";
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
  useEditing 
} from "@/hooks";
import { enforceOutputFormat } from "@/lib/format-output";
import { getSummaryTitle } from "@/lib/output-previews";
import { estimateFlashcardsPerSection, estimateQuizQuestions } from "@/lib/study-heuristics";
import { handleTabChange, handleCloseTabRequest, handleCloseTabConfirm, type TabHandlersContext } from "@/lib/handlers/tab-handlers";
import { handleRefineSubmit, handleCopySummary, handleCopySummarySecond, handleEditStart, handleEditSave, handleEditStartSecond, handleEditSaveSecond, type SummaryHandlersContext } from "@/lib/handlers/summary-handlers";

export default function AppClient() {
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
    setStatsOpen
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
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copySuccessSecond, setCopySuccessSecond] = useState(false);
  const [tabToDelete, setTabToDelete] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"input" | "output">("input");

  // Refs
  const previewRef1 = useRef<HTMLDivElement | null>(null);
  const previewRef2 = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef<boolean>(false);
  const refineTargetRef = useRef<string>("");

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
      setError(chatError.message);
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
  const { docSection, studySection, textForEstimate, handleGenerate } = generation;

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
  const streamingRefineContent = useMemo(() => {
    if (!chatConfig.isLoading) return null;
    const assistantMessages = chatConfig.messages.filter(m => m.role === "assistant");
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    return lastAssistant?.content || null;
  }, [chatConfig.isLoading, chatConfig.messages]);

  const currentCost = useMemo(() => {
    return modelCosts.find((row) => row.id === selectedModel);
  }, [modelCosts, selectedModel]);

  const currentKind: OutputKind = (currentOutput?.kind as OutputKind) || "summary";
  const isCurrentTabRefining = chatConfig.isLoading && refineTargetRef.current === selectedTabId;
  const currentSummary = isCurrentTabRefining && streamingRefineContent 
    ? streamingRefineContent 
    : (currentOutput?.summary ?? "");
  const currentUsage = currentOutput?.usage ?? null;
  const secondSummary = secondOutput?.summary ?? "";

  // Effects
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (sidebarOpen || subjectPickerOpen || tabToDelete) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen, subjectPickerOpen, tabToDelete]);

  useEffect(() => {
    if (!chatConfig.data?.length) return;
    const latest = [...chatConfig.data].reverse().find((item) => {
      return typeof item === "object" && item !== null && (item as Record<string, unknown>).type === "usage";
    }) as { payload?: UsageStats } | undefined;

    if (latest?.payload) {
      const targetTabId = refineTargetRef.current;
      if (!targetTabId) return;
      setOutputs((prev) => {
        const existing = prev[targetTabId];
        if (!existing) return prev;
        return {
          ...prev,
          [targetTabId]: {
            ...existing,
            usage: latest.payload ?? null,
            updatedAt: Date.now()
          }
        };
      });
    }
  }, [chatConfig.data, setOutputs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

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
  const handleModelChange = (modelId: string): void => {
    setSelectedModel(modelId);
  };

  const tabContext: TabHandlersContext = {
    outputKind,
    selectedTabId,
    secondTabId,
    outputs,
    outputTabs: Object.values(outputs).sort((a, b) => b.updatedAt - a.updatedAt),
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
  };

  const handleTabChangeWrapper = (tabId: string, event?: React.MouseEvent): void => {
    handleTabChange(tabId, tabContext, event);
  };

  const handleCloseTabRequestWrapper = (tabId: string, event: React.MouseEvent): void => {
    handleCloseTabRequest(tabId, event, setTabToDelete);
  };

  const handleCloseTabConfirmWrapper = (tabId: string): void => {
    handleCloseTabConfirm(tabId, tabContext);
  };

  const summaryContext: SummaryHandlersContext = {
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
    currentSummaryText: currentSummary,
    setCopySuccess,
    editDraft,
    currentSummaryForEdit: currentSummary,
    setEditDraft,
    setOutputs,
    secondSummary,
    secondTabId,
    secondOutput,
    setIsEditingSecond,
    editDraftSecond,
    setEditDraftSecond,
    setCopySuccessSecond
  };

  const handleCopySummaryWrapper = async (): Promise<void> => {
    await handleCopySummary(summaryContext);
  };

  const handleCopySummarySecondWrapper = async (): Promise<void> => {
    await handleCopySummarySecond(summaryContext);
  };

  const handleEditStartWrapper = (): void => {
    handleEditStart(summaryContext);
  };

  const handleEditSaveWrapper = (): void => {
    handleEditSave(summaryContext);
  };

  const handleEditStartSecondWrapper = (): void => {
    handleEditStartSecond(summaryContext);
  };

  const handleEditSaveSecondWrapper = (): void => {
    handleEditSaveSecond(summaryContext);
  };

  const handleRefineSubmitWrapper = (event: React.FormEvent<HTMLFormElement>): void => {
    handleRefineSubmit(event, summaryContext);
  };

  const saveToHistory = (outputsToSave?: Record<string, any>, exportedSubjectTitle?: string, notionPageId?: string): void => {
    const outputsData = outputsToSave || outputs;
    if (!fileHandling.extractedText || Object.keys(outputsData).length === 0) return;

    const { getDocumentTitle } = require("@/lib/document-title");
    const { createPdfId, getSummaryTitle } = require("@/lib/output-previews");

    const derivedTitle = getDocumentTitle(fileHandling.extractedText, fileHandling.fileName);
    const summaryTab = Object.values(outputsData).find((o) => (o.kind ?? "summary") === "summary" && (o.summary ?? "").trim().length > 0);
    const title = summaryTab ? getSummaryTitle(summaryTab.summary ?? "", derivedTitle) : derivedTitle;
    const pdfId = createPdfId(fileHandling.fileName || "untitled", fileHandling.extractedText);
    const historyId = currentHistoryId || pdfId;
    const now = Date.now();

    updateHistoryState((prev) => {
      const existingEntry = prev.find((h) => {
        const hPdfId = createPdfId(h.fileName, h.extractedText);
        return hPdfId === pdfId;
      });

      let finalExportedSubject: string | undefined;
      if (exportedSubjectTitle !== undefined) {
        finalExportedSubject = exportedSubjectTitle || undefined;
      } else {
        finalExportedSubject = existingEntry?.exportedSubject;
      }

      const entry: HistoryEntry = {
        id: historyId,
        title,
        fileName: fileHandling.fileName,
        extractedText: fileHandling.extractedText,
        outputs: outputsData,
        structureHints,
        createdAt: existingEntry?.createdAt || now,
        updatedAt: now,
        exportedSubject: finalExportedSubject,
        notionPageId: notionPageId || existingEntry?.notionPageId
      };

      const filtered = prev.filter((item) => {
        if (item.id === entry.id) return false;
        if (existingEntry && item.id === existingEntry.id) return false;
        return true;
      });

      return [entry, ...filtered];
    });

    if (!currentHistoryId) setCurrentHistoryId(historyId);
  };

  const loadFromHistory = (entry: HistoryEntry): void => {
    fileHandling.setFileName(entry.fileName);
    fileHandling.setExtractedText(entry.extractedText);
    setOutputs(entry.outputs);
    setStructureHints(entry.structureHints);
    setCurrentHistoryId(entry.id);
    setLoadedFromHistory(true);
    setError("");
    setSidebarOpen(false);
    if (isSmallScreen) setMobileView("output");
    setIsEditing(false);
    setIsEditingSecond(false);
    setSecondTabId(null);
    if (entry.notionPageId) {
      exportHook.setLastExportedPageId(entry.notionPageId);
    } else {
      exportHook.setLastExportedPageId(null);
    }
    exportHook.setExportProgress(null);
    setMessages([]);
    setInput("");
    setData([]);
    const firstTabId = Object.keys(entry.outputs)[0];
    if (firstTabId) {
      setSelectedTabId(firstTabId);
      const tab = entry.outputs[firstTabId];
      if (tab) setSelectedModel(tab.modelId);
    }
  };

  const deleteHistoryEntry = (id: string, event: React.MouseEvent): void => {
    event.stopPropagation();
    updateHistoryState((prev) => prev.filter((entry) => entry.id !== id));
  };

  // UI computed values
  const statusClass = status === "error" ? "error" : status === "ready" ? "ready" : "busy";
  const statusTitle =
    status === "parsing"
      ? "Parsing PDF"
      : status === "summarizing"
        ? "Generating"
        : status === "refining"
          ? "Refining"
          : status === "exporting"
            ? "Exporting"
            : status === "error"
              ? "Error"
              : "Ready";
  const isGenerating = generatingTabId === selectedTabId && generatingTabId !== null;
  
  // Improved button state management with clearer navigation flow
  const canGenerate =
    status !== "parsing" &&
    status !== "summarizing" &&
    status !== "exporting" &&
    !chatConfig.isLoading &&
    Boolean(fileHandling.extractedText) &&
    Boolean(selectedModel) &&
    !generatingTabId;
  
  const canExport = 
    outputKind === "summary" && 
    !!currentSummary && 
    status !== "exporting" && 
    status !== "parsing" && 
    status !== "summarizing" &&
    !chatConfig.isLoading;
  
  const canViewOutput = Boolean(fileHandling.extractedText) && status !== "parsing";

  return (
    <div className="app">
      <HistorySidebar
        isOpen={sidebarOpen}
        history={history}
        currentHistoryId={currentHistoryId}
        onClose={() => setSidebarOpen(false)}
        onSelectEntry={loadFromHistory}
        onDeleteEntry={deleteHistoryEntry}
      />

      <div className="main">
        <header className="header">
          <div className="header-left">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Open history"
              title="History"
            >
              <IconMenu />
            </button>
            <h1 className="header-title">Zemni</h1>
          </div>
          <div className="header-right">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Light Mode" : "Dark Mode"}
              title={theme === "dark" ? "Light Mode" : "Dark Mode"}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </header>

        {isSmallScreen && (
          <div className="top-toolbar" role="region" aria-label="Controls">
            <div className="top-toolbar-left">
              <div className="mode-switch" role="tablist" aria-label="Output mode">
                <button
                  type="button"
                  className={`mode-btn${outputKind === "summary" ? " active" : ""}`}
                  onClick={() => setOutputKind("summary")}
                  aria-selected={outputKind === "summary"}
                >
                  Summary
                </button>
                <button
                  type="button"
                  className={`mode-btn${outputKind === "flashcards" ? " active" : ""}`}
                  onClick={() => setOutputKind("flashcards")}
                  aria-selected={outputKind === "flashcards"}
                >
                  Flashcards
                </button>
                <button
                  type="button"
                  className={`mode-btn${outputKind === "quiz" ? " active" : ""}`}
                  onClick={() => setOutputKind("quiz")}
                  aria-selected={outputKind === "quiz"}
                >
                  Quiz
                </button>
              </div>
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
              <div className="input-panel-modebar" role="region" aria-label="Output mode">
                <div className="mode-switch" role="tablist" aria-label="Output mode">
                  <button
                    type="button"
                    className={`mode-btn${outputKind === "summary" ? " active" : ""}`}
                    onClick={() => setOutputKind("summary")}
                    aria-selected={outputKind === "summary"}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    className={`mode-btn${outputKind === "flashcards" ? " active" : ""}`}
                    onClick={() => setOutputKind("flashcards")}
                    aria-selected={outputKind === "flashcards"}
                  >
                    Flashcards
                  </button>
                  <button
                    type="button"
                    className={`mode-btn${outputKind === "quiz" ? " active" : ""}`}
                    onClick={() => setOutputKind("quiz")}
                    aria-selected={outputKind === "quiz"}
                  >
                    Quiz
                  </button>
                </div>
              </div>
              <InputPanel
                fileName={fileHandling.fileName}
                selectedModel={selectedModel}
                models={models}
                structureHints={structureHints}
                showStructureHints={outputKind === "summary"}
                dragActive={fileHandling.dragActive}
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
                onSyncScroll={() => {}}
                onCloseSplit={() => setSecondTabId(null)}
                extractedText={fileHandling.extractedText}
              />
            ) : outputKind === "flashcards" ? (
              <div className="mode-panel">
                <FlashcardsMode
                  extractedText={fileHandling.extractedText}
                  fileName={fileHandling.fileName}
                  output={currentOutput}
                  showKeyboardHints={!isCoarsePointer}
                />
              </div>
            ) : (
              <div className="mode-panel">
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
                />
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
