"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { 
  Model, 
  Subject, 
  Status, 
  UsageStats, 
  OutputEntry, 
  HistoryEntry,
  CostRow,
  OutputKind,
  DocumentSection,
  Flashcard,
  QuizQuestion
} from "@/types";
import { useHistory, useTokenEstimate } from "@/hooks";
import { enforceOutputFormat } from "@/lib/format-output";
import { createPdfId, flashcardsToMarkdown, getSummaryTitle, renderQuizPreview } from "@/lib/output-previews";
import { estimateFlashcardsPerSection, estimateQuizQuestions } from "@/lib/study-heuristics";
import { getDocumentTitle } from "@/lib/document-title";

const QUIZ_MORE_BATCH_SIZE = 8;
const QUIZ_INITIAL_BATCH_CAP = 12;

const trimForModel = (text: string, maxChars: number): string => {
  const normalized = (text ?? "").trim();
  if (normalized.length <= maxChars) return normalized;
  const headSize = Math.floor(maxChars * 0.7);
  const tailSize = Math.max(0, maxChars - headSize);
  const head = normalized.slice(0, headSize).trim();
  const tail = normalized.slice(Math.max(0, normalized.length - tailSize)).trim();
  return `${head}\n\n...\n\n${tail}`;
};

export default function AppClient() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [models, setModels] = useState<Model[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [structureHints, setStructureHints] = useState<string>("");
  const [status, setStatus] = useState<Status>("ready");
  const [generatingTabId, setGeneratingTabId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [outputKind, setOutputKind] = useState<OutputKind>("summary");
  const [outputs, setOutputs] = useState<Record<string, OutputEntry>>({});
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [secondTabId, setSecondTabId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copySuccessSecond, setCopySuccessSecond] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSecond, setIsEditingSecond] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editDraftSecond, setEditDraftSecond] = useState("");
  const [tabToDelete, setTabToDelete] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastExportedPageId, setLastExportedPageId] = useState<string | null>(null);
  const [flashcardsDensity, setFlashcardsDensity] = useState<FlashcardsDensity>(2);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [pendingExport, setPendingExport] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [mobileView, setMobileView] = useState<"input" | "output">("input");
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef1 = useRef<HTMLDivElement | null>(null);
  const previewRef2 = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef<boolean>(false);
  
  const { history, updateHistoryState } = useHistory();
  const { 
    modelCosts, 
    costHeuristic, 
    isEstimating, 
    fetchTokenEstimate,
    setModelCosts,
    setCostHeuristic
  } = useTokenEstimate();

  const refineTargetRef = useRef<string>("");

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const update = () => setIsSmallScreen(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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

  const input = chatConfig.input;
  const handleInputChange = chatConfig.handleInputChange;
  const handleSubmit = chatConfig.handleSubmit;
  const isRefining = chatConfig.isLoading;
  const chatData = chatConfig.data;
  const setData = chatConfig.setData;
  const setMessages = chatConfig.setMessages;
  const setInput = chatConfig.setInput;
  const chatMessages = chatConfig.messages;

  const streamingRefineContent = useMemo(() => {
    if (!isRefining) return null;
    const assistantMessages = chatMessages.filter(m => m.role === "assistant");
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    return lastAssistant?.content || null;
  }, [isRefining, chatMessages]);

  const currentCost = useMemo(() => {
    return modelCosts.find((row) => row.id === selectedModel);
  }, [modelCosts, selectedModel]);

  // `selectedSubject` is kept for default selection in the export modal.

  const outputTabs = useMemo(() => {
    return Object.values(outputs).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [outputs]);

  const outputsForMode = useMemo(() => {
    return outputTabs.filter((tab) => (tab.kind ?? "summary") === outputKind);
  }, [outputTabs, outputKind]);

  const outputsForModeRecord = useMemo(() => {
    return outputsForMode.reduce<Record<string, OutputEntry>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [outputsForMode]);

  const docSection: DocumentSection = useMemo(() => {
    return {
      id: "doc",
      title: fileName ? fileName : "Document",
      text: extractedText
    };
  }, [fileName, extractedText]);

  const studySection: DocumentSection = useMemo(() => {
    return {
      ...docSection,
      text: trimForModel(extractedText, 18_000)
    };
  }, [docSection, extractedText]);

  const textForEstimate = outputKind === "summary" ? extractedText : studySection.text;

  const currentOutput = selectedTabId ? outputs[selectedTabId] : undefined;
  const currentKind: OutputKind = (currentOutput?.kind as OutputKind) || "summary";
  const isCurrentTabRefining = isRefining && refineTargetRef.current === selectedTabId;
  const currentSummary = isCurrentTabRefining && streamingRefineContent 
    ? streamingRefineContent 
    : (currentOutput?.summary ?? "");
  const currentUsage = currentOutput?.usage ?? null;

  const secondOutput = secondTabId ? outputs[secondTabId] : undefined;
  const secondSummary = secondOutput?.summary ?? "";
  const isSplitView = secondTabId !== null;

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    if (window.innerWidth >= 769) {
      setStatsOpen(true);
    }

    const fetchModels = async () => {
      try {
        const res = await fetch("/api/models");
        if (!res.ok) throw new Error("Could not load models.");
        const data = await res.json() as { models: Model[] };
        setModels(data.models);
        if (data.models.length > 0) setSelectedModel(data.models[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    };

    const fetchSubjects = async () => {
      try {
        const res = await fetch("/api/notion/subjects");
        if (!res.ok) return;
        const data = await res.json() as { subjects: Subject[] };
        setSubjects(data.subjects);
      } catch (err) {
        // Ignore
      }
    };

    fetchModels();
    fetchSubjects();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setIsCoarsePointer(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (sidebarOpen || subjectPickerOpen || tabToDelete) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen, subjectPickerOpen, tabToDelete]);

  useEffect(() => {
    if (outputsForMode.length === 0) {
      setSelectedTabId(null);
      setSecondTabId(null);
      return;
    }

    if (!selectedTabId || !outputsForMode.some((t) => t.id === selectedTabId)) {
      setSelectedTabId(outputsForMode[0].id);
    }

    setSecondTabId(null);
    setIsEditing(false);
    setIsEditingSecond(false);
  }, [outputKind, outputsForMode, selectedTabId]);

  useEffect(() => {
    if (!chatData?.length) return;
    const latest = [...chatData].reverse().find((item) => {
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
  }, [chatData]);

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
          ? Math.min(QUIZ_INITIAL_BATCH_CAP, estimateQuizQuestions(textForEstimate.length))
          : undefined;
      fetchTokenEstimate(textForEstimate, structureHints, {
        mode: outputKind,
        n,
        sectionsCount: outputKind === "summary" ? undefined : 1
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [
    textForEstimate,
    structureHints,
    outputKind,
    flashcardsDensity,
    fetchTokenEstimate
  ]);

  useEffect(() => {
    if (status === "ready" && Object.keys(outputs).length > 0 && extractedText && !generatingTabId && !loadedFromHistory) {
      saveToHistory();
    }
  }, [outputs, status, extractedText, generatingTabId, loadedFromHistory]);

  const handleTabChange = (tabId: string, event?: React.MouseEvent): void => {
    const isCtrlClick = outputKind === "summary" && event && (event.ctrlKey || event.metaKey);
    
    if (isCtrlClick && selectedTabId) {
      if (tabId === selectedTabId) return;
      if (tabId === secondTabId) {
        setSecondTabId(selectedTabId);
        setSelectedTabId(tabId);
        const tab = outputs[tabId];
        if (tab) setSelectedModel(tab.modelId);
        return;
      }
      setSecondTabId(tabId);
      return;
    }
    
    if (tabId === secondTabId) {
      setSecondTabId(null);
    }
    
    setSelectedTabId(tabId);
    setIsEditing(false);
    setIsEditingSecond(false);
    const tab = outputs[tabId];
    if (tab) setSelectedModel(tab.modelId);
    if (!generatingTabId || tabId !== generatingTabId) {
      setError("");
      setMessages([]);
      setInput("");
      setData([]);
    }
  };

  const handleCloseTabRequest = (tabId: string, event: React.MouseEvent): void => {
    event.stopPropagation();

    setTabToDelete(tabId);
  };

  const handleCloseTabConfirm = (tabId: string): void => {
    setTabToDelete(null);
    
    if (tabId === secondTabId) {
      setSecondTabId(null);
    }
    
    if (tabId === selectedTabId) {
      if (secondTabId) {
        setSelectedTabId(secondTabId);
        setSecondTabId(null);
      } else {
        const remainingTabs = outputTabs.filter(t => t.id !== tabId);
        setSelectedTabId(remainingTabs.length > 0 ? remainingTabs[0].id : null);
      }
    }
    
    setOutputs((prev) => {
      const newOutputs = { ...prev };
      delete newOutputs[tabId];
      return newOutputs;
    });
    
    setIsEditing(false);
    setIsEditingSecond(false);
  };

  const handleModelChange = (modelId: string): void => {
    setSelectedModel(modelId);
  };

  const handleFile = async (file: File): Promise<void> => {
    setError("");
    
    const largeFileThreshold = 50 * 1024 * 1024;
    if (file.size > largeFileThreshold) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      console.warn(`Large file detected (${fileSizeMB} MB). Parsing may take a bit longer.`);
    }
    
    setStatus("parsing");
    setMobileView("input");
    setFileName(file.name);
    setOutputs({});
    setSelectedTabId(null);
    setSecondTabId(null);
    setGeneratingTabId(null);
    setLoadedFromHistory(false);
    setCurrentHistoryId(null);
    setMessages([]);
    setInput("");
    setData([]);
    setIsEditing(false);
    setIsEditingSecond(false);
    setLastExportedPageId(null);
    setExportProgress(null);
    refineTargetRef.current = "";
    
    try {
      let extractedText = "";
      let normalizedText: string | null = null;

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        try {
          const { extractTextFromPdf } = await import("@/lib/parse-pdf-client.ts");
          extractedText = await extractTextFromPdf(file);
        } catch (parseError) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/parse-pdf", {
            method: "POST",
            body: formData
          });
          if (!res.ok) {
            const clientMessage = parseError instanceof Error ? parseError.message : "Unknown error";
            throw new Error(`Client parsing failed. Server fallback failed. (${clientMessage})`);
          }
          const data = await res.json() as { text: string };
          normalizedText = data.text ?? "";
        }
      } else if (file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")) {
        extractedText = await file.text();
        normalizedText = extractedText;
      } else {
        extractedText = await file.text();
      }

      if (normalizedText === null) {
        const res = await fetch("/api/parse-pdf", {
          method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractedText })
      });

        if (!res.ok) throw new Error("Could not normalize text.");

        const data = await res.json() as { text: string };
        normalizedText = data.text ?? "";
      }

      setExtractedText(normalizedText);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const postJson = async <T,>(
    url: string,
    payload: unknown,
    timeoutMs: number = 60_000
  ): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const text = await res.text();
      if (!res.ok) {
        const message = (() => {
          try {
            const parsed = JSON.parse(text) as { error?: string; message?: string };
            return parsed.error || parsed.message;
          } catch {
            return null;
          }
        })();
        throw new Error(message || "Request failed.");
      }

      return (text ? (JSON.parse(text) as T) : ({} as T));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const handleGenerate = async (): Promise<void> => {
    if (!extractedText) {
      setError("Upload a PDF/MD file first.");
      setStatus("error");
      return;
    }
    if (!selectedModel) {
      setError("Select a model.");
      setStatus("error");
      return;
    }

    const previousTabId = selectedTabId;
    const tabId = selectedModel + "-" + Date.now();
    const modelLabel = models.find((m) => m.id === selectedModel)?.displayName || selectedModel;

    if (isSmallScreen) setMobileView("output");
    setOutputs((prev) => ({
      ...prev,
      [tabId]: {
        id: tabId,
        modelId: selectedModel,
        label: modelLabel,
        summary: "",
        usage: null,
        updatedAt: Date.now(),
        isGenerating: true,
        error: undefined,
        kind: outputKind,
        sectionIds: ["doc"],
        flashcards: outputKind === "flashcards" ? [] : undefined,
        quiz: outputKind === "quiz" ? [] : undefined,
        quizState:
          outputKind === "quiz"
            ? {
                questionCursor: 0,
                revealAnswer: false
              }
            : undefined
      }
    }));

    setSelectedTabId(tabId);
    setGeneratingTabId(tabId);
    setError("");
    setStatus("summarizing");
    setLoadedFromHistory(false);
    setIsEditing(false);
    setData([]);

    try {
      if (outputKind === "summary") {
        const data = await postJson<{ summary: string; usage?: UsageStats | null }>(
          "/api/section-summary",
          {
            sections: [docSection],
            modelId: selectedModel,
            structure: structureHints,
            titleHint: fileName
          },
          75_000
        );

        setOutputs((prev) => ({
          ...prev,
          [tabId]: {
            ...prev[tabId],
            error: undefined,
            summary: data.summary || "",
            usage: data.usage ?? null,
            updatedAt: Date.now(),
            isGenerating: false,
            kind: "summary"
          }
        }));
      } else if (outputKind === "flashcards") {
        const data = await postJson<{ flashcards: Flashcard[]; usage?: UsageStats | null }>(
          "/api/flashcards",
          {
            sections: [studySection],
            modelId: selectedModel,
            coverageLevel: flashcardsDensity
          },
          75_000
        );
        const markdown = flashcardsToMarkdown(data.flashcards ?? [], fileName);

        setOutputs((prev) => ({
          ...prev,
          [tabId]: {
            ...prev[tabId],
            error: undefined,
            summary: markdown,
            usage: data.usage ?? null,
            updatedAt: Date.now(),
            isGenerating: false,
            kind: "flashcards",
            flashcards: data.flashcards ?? []
          }
        }));
      } else if (outputKind === "quiz") {
        const data = await postJson<{ questions: QuizQuestion[]; usage?: UsageStats | null }>(
          "/api/quiz",
          {
            section: studySection,
            modelId: selectedModel,
            questionsCount: Math.min(QUIZ_INITIAL_BATCH_CAP, estimateQuizQuestions(extractedText.length)),
            avoidQuestions: []
          },
          75_000
        );

        setOutputs((prev) => {
          const existing = prev[tabId];
          if (!existing) return prev;
          const next: OutputEntry = {
            ...existing,
            error: undefined,
            quiz: data.questions ?? [],
            usage: data.usage ?? null,
            updatedAt: Date.now(),
            isGenerating: false,
            kind: "quiz"
          };
          next.summary = renderQuizPreview(next, fileName);
          return { ...prev, [tabId]: next };
        });
      }

      setMessages([]);
      setInput("");
      setStatus("ready");
      setGeneratingTabId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setOutputs((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
      setSelectedTabId(previousTabId);
      if (isSmallScreen) setMobileView("input");
      setError(message);
      setStatus("error");
      setGeneratingTabId(null);
    }
  };

  const handleQuizReveal = () => {
    if (!selectedTabId) return;
    setOutputs((prev) => {
      const existing = prev[selectedTabId];
      if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
      const next: OutputEntry = {
        ...existing,
        quizState: {
          ...existing.quizState,
          revealAnswer: !existing.quizState.revealAnswer
        },
        updatedAt: Date.now()
      };
      next.summary = renderQuizPreview(next, fileName);
      return { ...prev, [selectedTabId]: next };
    });
  };

  const handleQuizSelectOption = (selectedOptionIndex: number) => {
    if (!selectedTabId) return;
    setOutputs((prev) => {
      const existing = prev[selectedTabId];
      if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
      const next: OutputEntry = {
        ...existing,
        quizState: {
          ...existing.quizState,
          selectedOptionIndex,
          revealAnswer: true
        },
        updatedAt: Date.now()
      };
      next.summary = renderQuizPreview(next, fileName);
      return { ...prev, [selectedTabId]: next };
    });
  };

  const handleQuizNext = async () => {
    if (!selectedTabId) return;
    const output = outputs[selectedTabId];
    if (!output || output.kind !== "quiz" || !output.quizState) return;

    const state = output.quizState;
    const nextCursor = state.questionCursor + 1;
    const questions = output.quiz ?? [];

    if (nextCursor < questions.length) {
      setOutputs((prev) => {
        const existing = prev[selectedTabId];
        if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
        const next: OutputEntry = {
          ...existing,
          error: undefined,
          quizState: {
            ...existing.quizState,
            questionCursor: nextCursor,
            revealAnswer: false,
            selectedOptionIndex: undefined
          },
          updatedAt: Date.now()
        };
        next.summary = renderQuizPreview(next, fileName);
        return { ...prev, [selectedTabId]: next };
      });
      return;
    }

    setError("");
    setStatus("summarizing");
    setGeneratingTabId(selectedTabId);
    setOutputs((prev) => {
      const existing = prev[selectedTabId];
      if (!existing) return prev;
      return {
        ...prev,
        [selectedTabId]: {
          ...existing,
          isGenerating: true,
          error: undefined,
          summary: "# Quiz\n\nGenerating questions...\n",
          updatedAt: Date.now()
        }
      };
    });

    try {
      const avoid = (output.quiz ?? []).map((q) => q.question).filter(Boolean);
      const data = await postJson<{ questions: QuizQuestion[]; usage?: UsageStats | null }>(
        "/api/quiz",
        {
          section: studySection,
          modelId: output.modelId,
          questionsCount: Math.min(QUIZ_MORE_BATCH_SIZE, estimateQuizQuestions(extractedText.length)),
          avoidQuestions: avoid
        },
        75_000
      );

      setOutputs((prev) => {
        const existing = prev[selectedTabId];
        if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
        const appended = data.questions ?? [];
        const cursor = (existing.quiz ?? []).length;
        const next: OutputEntry = {
          ...existing,
          isGenerating: false,
          error: undefined,
          quiz: [...(existing.quiz ?? []), ...appended],
          usage: data.usage ?? existing.usage,
          quizState: {
            ...existing.quizState,
            questionCursor: cursor,
            revealAnswer: false,
            selectedOptionIndex: undefined
          },
          updatedAt: Date.now()
        };
        next.summary = renderQuizPreview(next, fileName);
        return { ...prev, [selectedTabId]: next };
      });

      setStatus("ready");
      setGeneratingTabId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setStatus("error");
      setGeneratingTabId(null);
      setOutputs((prev) => {
        const existing = prev[selectedTabId];
        if (!existing) return prev;
        const next: OutputEntry = {
          ...existing,
          isGenerating: false,
          error: message,
          updatedAt: Date.now()
        };
        next.summary = renderQuizPreview(next, fileName);
        return { ...prev, [selectedTabId]: next };
      });
    }
  };

  const handleQuizPrev = () => {
    if (!selectedTabId) return;
    const output = outputs[selectedTabId];
    if (!output || output.kind !== "quiz" || !output.quizState) return;

    if (output.quizState.questionCursor <= 0) return;

    setOutputs((prev) => {
      const existing = prev[selectedTabId];
      if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
      const nextCursor = Math.max(0, existing.quizState.questionCursor - 1);
      const next: OutputEntry = {
        ...existing,
        quizState: {
          ...existing.quizState,
          questionCursor: nextCursor,
          revealAnswer: false,
          selectedOptionIndex: undefined
        },
        updatedAt: Date.now()
      };
      next.summary = renderQuizPreview(next, fileName);
      return { ...prev, [selectedTabId]: next };
    });
  };

  const handleSubjectPicked = (subjectId: string) => {
    setSelectedSubject(subjectId);
    setSubjectPickerOpen(false);
    if (pendingExport) {
      setPendingExport(false);
      void handleExport(subjectId);
      return;
    }
    setPendingExport(false);
  };

  const handleExport = async (overrideSubjectId?: string): Promise<void> => {
    const subjectId = overrideSubjectId ?? "";
    if (currentKind !== "summary") {
      setError("Only summaries can be exported to Notion.");
      setStatus("error");
      return;
    }
    if (!currentSummary) {
      setError("No summary to export.");
      setStatus("error");
      return;
    }
    if (!subjectId) {
      setError("");
      setPendingExport(true);
      setSubjectPickerOpen(true);
      return;
    }
    setError("");
    setStatus("exporting");
    setExportProgress(null);
    setLastExportedPageId(null);
    setPendingExport(false);

    try {
      const title = getSummaryTitle(currentSummary, fileName || "Summary");
      const res = await fetch("/api/notion/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          title,
          markdown: currentSummary,
          stream: true
        })
      });

      if (!res.ok) throw new Error("Notion export failed.");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream not available.");

      const decoder = new TextDecoder();
      let buffer = "";
      let exportedPageId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as { type: string; [key: string]: unknown };
            if (event.type === "started") {
              setExportProgress({ current: 0, total: event.totalChunks as number });
            } else if (event.type === "chunk") {
              setExportProgress({ current: event.index as number, total: event.totalChunks as number });
            } else if (event.type === "done") {
              exportedPageId = event.pageId as string;
              setLastExportedPageId(exportedPageId);
            } else if (event.type === "error") {
              throw new Error(event.message as string || "Export failed");
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Export failed") {
              console.warn("Failed to parse export event:", parseErr);
            } else {
              throw parseErr;
            }
          }
        }
      }

      setStatus("ready");
      setExportProgress(null);
      const subjectTitle = subjects.find((s) => s.id === selectedSubject)?.title;
      setLoadedFromHistory(false);
      if (outputs && extractedText && subjectTitle) {
        saveToHistory(undefined, subjectTitle, exportedPageId || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
      setExportProgress(null);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (): void => {
    setDragActive(false);
  };

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRefineSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (currentKind !== "summary" || !currentSummary || !selectedTabId || !currentOutput) {
      setError("No summary available.");
      setStatus("error");
      return;
    }
    setStatus("refining");
    if (isSmallScreen) setMobileView("output");
    setLoadedFromHistory(false);
    setIsEditing(false);
    refineTargetRef.current = selectedTabId;
    setData([]);
    handleSubmit(event, {
      body: {
        summary: currentSummary,
        modelId: currentOutput.modelId
      }
    });
  };

  const saveToHistory = (outputsToSave?: Record<string, OutputEntry>, exportedSubjectTitle?: string, notionPageId?: string): void => {
    const outputsData = outputsToSave || outputs;
    if (!extractedText || Object.keys(outputsData).length === 0) return;

    const derivedTitle = getDocumentTitle(extractedText, fileName);
    const summaryTab = Object.values(outputsData).find((o) => (o.kind ?? "summary") === "summary" && (o.summary ?? "").trim().length > 0);
    const title = summaryTab ? getSummaryTitle(summaryTab.summary ?? "", derivedTitle) : derivedTitle;
    const pdfId = createPdfId(fileName || "untitled", extractedText);
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
        fileName,
        extractedText,
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
    setFileName(entry.fileName);
    setExtractedText(entry.extractedText);
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
    setLastExportedPageId(entry.notionPageId || null);
    setExportProgress(null);
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

  const handleCopySummary = async (): Promise<void> => {
    if (!currentSummary) return;
    try {
      await navigator.clipboard.writeText(currentSummary);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = currentSummary;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (e) {
        // Ignore
      }
      document.body.removeChild(textArea);
    }
  };

  const handleEditStart = (): void => {
    setEditDraft(currentSummary);
    setIsEditing(true);
  };

  const handleEditSave = (): void => {
    if (!selectedTabId || !currentOutput || editDraft === currentSummary) {
      setIsEditing(false);
      return;
    }
    setOutputs((prev) => ({
      ...prev,
      [selectedTabId]: {
        ...currentOutput,
        summary: editDraft,
        updatedAt: Date.now()
      }
    }));
    setLoadedFromHistory(false);
    setIsEditing(false);
  };

  const handleEditStartSecond = (): void => {
    setEditDraftSecond(secondSummary);
    setIsEditingSecond(true);
  };

  const handleEditSaveSecond = (): void => {
    if (!secondTabId || !secondOutput || editDraftSecond === secondSummary) {
      setIsEditingSecond(false);
      return;
    }
    setOutputs((prev) => ({
      ...prev,
      [secondTabId]: {
        ...secondOutput,
        summary: editDraftSecond,
        updatedAt: Date.now()
      }
    }));
    setLoadedFromHistory(false);
    setIsEditingSecond(false);
  };

  const handleCopySummarySecond = async (): Promise<void> => {
    if (!secondSummary) return;
    try {
      await navigator.clipboard.writeText(secondSummary);
      setCopySuccessSecond(true);
      setTimeout(() => setCopySuccessSecond(false), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = secondSummary;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopySuccessSecond(true);
        setTimeout(() => setCopySuccessSecond(false), 2000);
      } catch (e) {
        // Ignore
      }
      document.body.removeChild(textArea);
    }
  };

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
  const canGenerate =
    status !== "parsing" &&
    status !== "summarizing" &&
    !isRefining &&
    Boolean(extractedText) &&
    Boolean(selectedModel);
  const canExport = outputKind === "summary" && !!currentSummary && status !== "exporting";

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
            setPendingExport(false);
          }}
        /> 
        <DeleteOutputModal
          isOpen={tabToDelete !== null}
          outputLabel={tabToDelete ? outputs[tabToDelete]?.label ?? "Output" : "Output"}
          onCancel={() => setTabToDelete(null)}
          onConfirm={() => {
            if (!tabToDelete) return;
            handleCloseTabConfirm(tabToDelete);
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
                fileName={fileName}
                selectedModel={selectedModel}
                models={models}
                structureHints={structureHints}
                showStructureHints={outputKind === "summary"}
                dragActive={dragActive}
                dropzoneCorner={
                  <span
                    className={`status-dot ${statusClass} status-dot-corner`}
                    title={statusTitle}
                    aria-label={statusTitle}
                  />
                }
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onSelectFile={onSelectFile}
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
                        totalChars={studySection.text.length}
                        disabled={!extractedText || status === "parsing" || status === "summarizing"}
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
              fileName={fileName}
              selectedModel={selectedModel}
              models={models}
              structureHints={structureHints}
              showStructureHints={outputKind === "summary"}
              dragActive={dragActive}
              dropzoneCorner={
                <span
                  className={`status-dot ${statusClass} status-dot-corner`}
                  title={statusTitle}
                  aria-label={statusTitle}
                />
              }
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onSelectFile={onSelectFile}
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
                      totalChars={studySection.text.length}
                      disabled={!extractedText || status === "parsing" || status === "summarizing"}
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
                    disabled={!extractedText}
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
                onTabChange={handleTabChange}
                onCloseTab={handleCloseTabRequest}
              />
              <div className="output-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
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
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditStartSecond={handleEditStartSecond}
                onEditSaveSecond={handleEditSaveSecond}
                onEditDraftChange={setEditDraft}
                onEditDraftChangeSecond={setEditDraftSecond}
                onCopySummary={handleCopySummary}
                onCopySummarySecond={handleCopySummarySecond}
                onSyncScroll={() => {}}
                onCloseSplit={() => setSecondTabId(null)}
                extractedText={extractedText}
              />
            ) : outputKind === "flashcards" ? (
              <div className="mode-panel">
                <FlashcardsMode
                  extractedText={extractedText}
                  fileName={fileName}
                  output={currentOutput}
                  showKeyboardHints={!isCoarsePointer}
                />
              </div>
            ) : (
              <div className="mode-panel">
                  <QuizMode
                    extractedText={extractedText}
                    fileName={fileName}
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
                input={input}
                isRefining={isRefining}
                hasCurrentSummary={!!currentSummary}
                onInputChange={handleInputChange}
                onSubmit={handleRefineSubmit}
              />
            )}
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
