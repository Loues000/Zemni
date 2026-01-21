"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type Pricing = {
  currency: string;
  input_per_1m: number | null;
  output_per_1m: number | null;
};

type Model = {
  id: string;
  name: string;
  provider: string;
  displayName: string;
  tokenizer: string;
  pricing: Pricing;
};

type CostRow = {
  id: string;
  name: string;
  provider: string;
  tokenizer: string;
  tokensIn: number;
  tokensOut: number;
  costIn: number | null;
  costOut: number | null;
  total: number | null;
  currency: string;
  inPer1m: number | null;
  outPer1m: number | null;
};

type Subject = {
  id: string;
  title: string;
};

type Status = "idle" | "parsing" | "summarizing" | "refining" | "exporting" | "error" | "ready";

type UsageStats = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  tokensPerSecond: number | null;
  costIn: number | null;
  costOut: number | null;
  costTotal: number | null;
  currency: string | null;
  source: "summarize" | "refine";
};

type OutputEntry = {
  id: string;
  modelId: string;
  label: string;
  summary: string;
  usage: UsageStats | null;
  updatedAt: number;
  isGenerating?: boolean;
};

type HistoryEntry = {
  id: string;
  title: string;
  fileName: string;
  extractedText: string;
  outputs: Record<string, OutputEntry>;
  structureHints: string;
  createdAt: number;
  updatedAt: number;
  exportedSubject?: string;
  notionPageId?: string;
};

type CostHeuristic = {
  outputRatio: number;
  outputCap: number;
  estimatedOutputTokens: number;
};

const statusLabels: Record<Status, string> = {
  idle: "Bereit",
  parsing: "PDF wird gelesen",
  summarizing: "Generiert",
  refining: "Ueberarbeitet",
  exporting: "Exportiert",
  error: "Fehler",
  ready: "Bereit"
};

const formatMoney = (value: number | null, currency: string): string => {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toFixed(4) + " " + currency;
};

const formatNumber = (value: number | null, digits: number = 0): string => {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const formatSeconds = (ms: number | null): string => {
  if (!ms) return "-";
  return (ms / 1000).toFixed(2) + "s";
};

const getSummaryTitle = (summary: string, fallback: string): string => {
  const match = summary.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fallback;
};

/**
 * Client-side output format enforcement for streamed content.
 * Ensures the summary starts with an H1 heading and has no leading metadata.
 */
const enforceClientOutputFormat = (text: string): string => {
  let result = text.trim();

  // Remove YAML frontmatter if present
  result = result.replace(/^---[\s\S]*?---\s*/, "").trim();

  // Remove common metadata patterns from the beginning
  const metadataPatterns = [
    /^(Zusammenfassung|Summary|Titel|Title|Datum|Date|Autor|Author|Fach|Subject):\s*[^\n]*\n*/gi,
    /^\*\*[^*]+\*\*:\s*[^\n]*\n*/g,
    /^-{3,}\s*\n*/g,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of metadataPatterns) {
      const before = result;
      result = result.replace(pattern, "").trim();
      if (result !== before) changed = true;
    }
  }

  // Check if the first non-empty line is an H1
  const lines = result.split("\n");
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLineIndex === -1) {
    return result;
  }

  const firstLine = lines[firstContentLineIndex].trim();

  // If first line is already H1, we're good
  if (firstLine.startsWith("# ")) {
    return result;
  }

  // If first line is H2/H3, convert to H1
  if (firstLine.startsWith("## ")) {
    lines[firstContentLineIndex] = "# " + firstLine.slice(3);
    return lines.join("\n").trim();
  }
  if (firstLine.startsWith("### ")) {
    lines[firstContentLineIndex] = "# " + firstLine.slice(4);
    return lines.join("\n").trim();
  }
  if (firstLine.startsWith("**") && firstLine.endsWith("**") && !firstLine.includes("\n")) {
    const titleText = firstLine.slice(2, -2);
    lines[firstContentLineIndex] = "# " + titleText;
    return lines.join("\n").trim();
  }

  // No H1 found - keep as is (server should have handled this for initial summaries)
  return result;
};

const getModelLabel = (models: Model[], modelId: string): string => {
  const model = models.find((item) => item.id === modelId);
  return model ? model.displayName : modelId;
};

const createPdfId = (fileName: string, extractedText: string): string => {
  const content = fileName + ":" + extractedText.slice(0, 1000);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "pdf-" + Math.abs(hash).toString(36);
};

const HISTORY_STORAGE_KEY = "summary-maker-history-v1";

const sortHistory = (entries: HistoryEntry[]): HistoryEntry[] => {
  return entries.slice().sort((a, b) => b.updatedAt - a.updatedAt);
};

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

const loadHistoryFromStorage = (): HistoryEntry[] => {
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

const saveHistoryToStorage = (entries: HistoryEntry[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    // Ignore storage errors
  }
};

const groupHistoryByTime = (history: HistoryEntry[]): Array<[string, HistoryEntry[]]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekAgo = todayStart - 7 * 24 * 60 * 60 * 1000;

  const groups: Record<string, HistoryEntry[]> = {
    Heute: [],
    Gestern: [],
    "Letzte Woche": [],
    Aelter: []
  };

  history.forEach((entry) => {
    const t = entry.updatedAt;
    if (t >= todayStart) groups.Heute.push(entry);
    else if (t >= yesterdayStart) groups.Gestern.push(entry);
    else if (t >= weekAgo) groups["Letzte Woche"].push(entry);
    else groups.Aelter.push(entry);
  });

  return Object.entries(groups).filter(([, entries]) => entries.length > 0);
};

function IconMenu(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );
}

function IconX(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconSun(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconMoon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconCopy(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconEdit(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconChevron(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconClose(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}


export default function AppClient(): JSX.Element {
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
  const [modelCosts, setModelCosts] = useState<CostRow[]>([]);
  const [outputs, setOutputs] = useState<Record<string, OutputEntry>>({});
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [secondTabId, setSecondTabId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
  const [costHeuristic, setCostHeuristic] = useState<CostHeuristic | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastExportedPageId, setLastExportedPageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const estimateAbortRef = useRef<AbortController | null>(null);
  const refineTargetRef = useRef<string>("");
  const previewRef1 = useRef<HTMLDivElement | null>(null);
  const previewRef2 = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef<boolean>(false);

  const chatConfig = useChat({
    api: "/api/refine",
    onFinish: (message) => {
      const targetTabId = refineTargetRef.current;
      const content = message?.content || "";
      if (targetTabId && content) {
        // Apply client-side format enforcement for streamed content
        const formattedContent = enforceClientOutputFormat(content);
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

  // Get the latest assistant message (streaming response during refine)
  const streamingRefineContent = useMemo(() => {
    if (!isRefining) return null;
    const assistantMessages = chatMessages.filter(m => m.role === "assistant");
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    return lastAssistant?.content || null;
  }, [isRefining, chatMessages]);

  const currentCost = useMemo(() => {
    return modelCosts.find((row) => row.id === selectedModel);
  }, [modelCosts, selectedModel]);

  const outputTabs = useMemo(() => {
    return Object.values(outputs).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [outputs]);

  const currentOutput = selectedTabId ? outputs[selectedTabId] : undefined;
  // Show streaming content during refine if the current tab is being refined
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
        if (!res.ok) throw new Error("Modelle konnten nicht geladen werden.");
        const data = (await res.json()) as { models: Model[] };
        setModels(data.models);
        if (data.models.length > 0) setSelectedModel(data.models[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        setStatus("error");
      }
    };

    const fetchSubjects = async () => {
      try {
        const res = await fetch("/api/notion/subjects");
        if (!res.ok) return;
        const data = (await res.json()) as { subjects: Subject[] };
        setSubjects(data.subjects);
        if (data.subjects.length > 0) setSelectedSubject(data.subjects[0].id);
      } catch (err) {
        // Ignore
      }
    };

    fetchModels();
    fetchSubjects();
    setHistory(loadHistoryFromStorage());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

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

  // Debounced token estimation - calls /api/token-estimate when extractedText or structureHints change
  const fetchTokenEstimate = useCallback(async (text: string, hints: string) => {
    if (!text) {
      setModelCosts([]);
      setCostHeuristic(null);
      return;
    }

    // Abort any pending request
    if (estimateAbortRef.current) {
      estimateAbortRef.current.abort();
    }
    estimateAbortRef.current = new AbortController();

    setIsEstimating(true);
    try {
      const res = await fetch("/api/token-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText: text, structureHints: hints }),
        signal: estimateAbortRef.current.signal
      });
      if (!res.ok) throw new Error("Token estimate failed");
      const data = (await res.json()) as { modelCosts: CostRow[]; heuristic: CostHeuristic };
      setModelCosts(data.modelCosts || []);
      setCostHeuristic(data.heuristic || null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Ignore aborted requests
        return;
      }
      // Keep existing costs on error
    } finally {
      setIsEstimating(false);
    }
  }, []);

  useEffect(() => {
    if (!extractedText) {
      setModelCosts([]);
      setCostHeuristic(null);
      return;
    }

    // Debounce: wait 300ms after last change
    const timer = setTimeout(() => {
      fetchTokenEstimate(extractedText, structureHints);
    }, 300);

    return () => clearTimeout(timer);
  }, [extractedText, structureHints, fetchTokenEstimate]);

  const handleTabChange = (tabId: string, event?: React.MouseEvent): void => {
    const isCtrlClick = event && (event.ctrlKey || event.metaKey);
    
    // Ctrl+Click logic for split view
    if (isCtrlClick && selectedTabId) {
      if (tabId === selectedTabId) {
        // Ctrl+Click on already selected tab - do nothing (can't split same tab)
        return;
      }
      if (tabId === secondTabId) {
        // Ctrl+Click on tab that's already in split - swap primary and secondary
        setSecondTabId(selectedTabId);
        setSelectedTabId(tabId);
        const tab = outputs[tabId];
        if (tab) setSelectedModel(tab.modelId);
        return;
      }
      // Open new tab in split view
      setSecondTabId(tabId);
      return;
    }
    
    // Normal click logic
    if (tabId === secondTabId) {
      // Clicking on secondary tab - close split and make it primary
      setSecondTabId(null);
    }
    
    setSelectedTabId(tabId);
    setIsEditing(false);
    setIsEditingSecond(false);
    const tab = outputs[tabId];
    if (tab) {
      setSelectedModel(tab.modelId);
    }
    if (!generatingTabId || tabId !== generatingTabId) {
      setError("");
      setMessages([]);
      setInput("");
      setData([]);
    }
  };

  const handleCloseTabRequest = (tabId: string, event: React.MouseEvent): void => {
    event.stopPropagation();
    
    // If already confirming this tab, do the actual delete
    if (tabToDelete === tabId) {
      handleCloseTabConfirm(tabId);
      return;
    }
    
    // First click - show confirmation
    setTabToDelete(tabId);
    
    // Auto-reset after 3 seconds if not confirmed
    setTimeout(() => {
      setTabToDelete((current) => current === tabId ? null : current);
    }, 3000);
  };

  const handleCloseTabConfirm = (tabId: string): void => {
    setTabToDelete(null);
    
    // If closing the second tab in split view
    if (tabId === secondTabId) {
      setSecondTabId(null);
      return;
    }
    
    // If closing the primary tab
    if (tabId === selectedTabId) {
      // If in split view, promote second tab to primary
      if (secondTabId) {
        setSelectedTabId(secondTabId);
        setSecondTabId(null);
      } else {
        // Find another tab to select
        const remainingTabs = outputTabs.filter(t => t.id !== tabId);
        setSelectedTabId(remainingTabs.length > 0 ? remainingTabs[0].id : null);
      }
    }
    
    // Remove the tab from outputs
    setOutputs((prev) => {
      const newOutputs = { ...prev };
      delete newOutputs[tabId];
      return newOutputs;
    });
    
    setIsEditing(false);
    setIsEditingSecond(false);
  };

  const handleSyncScroll = (source: 1 | 2) => {
    if (isScrolling.current) return;
    
    const sourceRef = source === 1 ? previewRef1 : previewRef2;
    const targetRef = source === 1 ? previewRef2 : previewRef1;
    
    if (!sourceRef.current || !targetRef.current) return;
    
    isScrolling.current = true;
    
    const sourceEl = sourceRef.current;
    const targetEl = targetRef.current;
    
    // Calculate scroll percentage
    const scrollPercent = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight);
    const targetScrollTop = scrollPercent * (targetEl.scrollHeight - targetEl.clientHeight);
    
    targetEl.scrollTop = targetScrollTop;
    
    setTimeout(() => {
      isScrolling.current = false;
    }, 50);
  };

  const handleModelChange = (modelId: string): void => {
    setSelectedModel(modelId);
  };

  const handleFile = async (file: File): Promise<void> => {
    setError("");
    
    // Warn for very large files (but don't block - client-side parsing can handle them)
    const largeFileThreshold = 50 * 1024 * 1024; // 50MB
    if (file.size > largeFileThreshold) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      console.warn(`Große Datei erkannt (${fileSizeMB} MB). Das Parsing kann etwas länger dauern.`);
    }
    
    setStatus("parsing");
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
    setModelCosts([]);
    setCostHeuristic(null);
    setLastExportedPageId(null);
    setExportProgress(null);
    refineTargetRef.current = "";
    try {
      let extractedText = "";

      // Parse PDF client-side to avoid Vercel's 4.5MB body size limit
      // This allows handling files of any size (limited only by browser memory)
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        // Dynamic import with @ alias and explicit extension for nodenext resolution
        // @ts-expect-error - Next.js resolves @/ alias with .ts extension at build time
        const { extractTextFromPdf } = await import("@/lib/parse-pdf-client.ts");
        extractedText = await extractTextFromPdf(file);
      } else {
        // For non-PDF files, read as text
        extractedText = await file.text();
      }

      // Normalize the extracted text
      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractedText })
      });

      if (!res.ok) {
        throw new Error("Text konnte nicht normalisiert werden.");
      }

      const data = (await res.json()) as { text: string };
      setExtractedText(data.text || "");
      // Token estimation is handled by the debounced effect
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("error");
    }
  };

  const handleGenerate = async (): Promise<void> => {
    if (!extractedText) {
      setError("Zuerst PDF hochladen.");
      setStatus("error");
      return;
    }
    if (!selectedModel) {
      setError("Modell auswaehlen.");
      setStatus("error");
      return;
    }
    
    // Create unique tab ID and show tab immediately
    const tabId = selectedModel + "-" + Date.now();
    const modelLabel = getModelLabel(models, selectedModel);
    
    setOutputs((prev) => ({
      ...prev,
      [tabId]: {
        id: tabId,
        modelId: selectedModel,
        label: modelLabel,
        summary: "",
        usage: null,
        updatedAt: Date.now(),
        isGenerating: true
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
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractedText,
          modelId: selectedModel,
          structure: structureHints
        })
      });
      if (!res.ok) throw new Error("Zusammenfassung fehlgeschlagen.");
      const data = (await res.json()) as { summary: string; usage?: UsageStats | null };
      setOutputs((prev) => ({
        ...prev,
        [tabId]: {
          id: tabId,
          modelId: selectedModel,
          label: modelLabel,
          summary: data.summary || "",
          usage: data.usage ?? null,
          updatedAt: Date.now(),
          isGenerating: false
        }
      }));
      setMessages([]);
      setInput("");
      setStatus("ready");
      setGeneratingTabId(null);
    } catch (err) {
      // Remove the failed tab or mark it as error
      setOutputs((prev) => {
        const newOutputs = { ...prev };
        delete newOutputs[tabId];
        return newOutputs;
      });
      setSelectedTabId(null);
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("error");
      setGeneratingTabId(null);
    }
  };

  const handleExport = async (): Promise<void> => {
    if (!currentSummary) {
      setError("Keine Zusammenfassung zum Export.");
      setStatus("error");
      return;
    }
    if (!selectedSubject) {
      setError("Fach auswaehlen.");
      setStatus("error");
      return;
    }
    setError("");
    setStatus("exporting");
    setExportProgress(null);
    setLastExportedPageId(null);

    try {
      const title = getSummaryTitle(currentSummary, fileName || "Zusammenfassung");
      const res = await fetch("/api/notion/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: selectedSubject,
          title,
          markdown: currentSummary,
          stream: true
        })
      });

      if (!res.ok) throw new Error("Notion Export fehlgeschlagen.");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream nicht verfuegbar.");

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
              throw new Error(event.message as string || "Export fehlgeschlagen");
            }
          } catch (parseErr) {
            // Ignore parse errors for incomplete lines
            if (parseErr instanceof Error && parseErr.message !== "Export fehlgeschlagen") {
              // Only log non-error-event parse errors
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
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
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
    if (!currentSummary || !selectedTabId || !currentOutput) {
      setError("Keine Zusammenfassung vorhanden.");
      setStatus("error");
      return;
    }
    setStatus("refining");
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

  const updateHistoryState = (updater: (prev: HistoryEntry[]) => HistoryEntry[]): void => {
    setHistory((prev) => {
      const next = sortHistory(updater(prev));
      saveHistoryToStorage(next);
      return next;
    });
  };

  const saveToHistory = (outputsToSave?: Record<string, OutputEntry>, exportedSubjectTitle?: string, notionPageId?: string): void => {
    const outputsData = outputsToSave || outputs;
    if (!extractedText || Object.keys(outputsData).length === 0) return;

    const firstSummary = Object.values(outputsData)[0]?.summary || "";
    const title = getSummaryTitle(firstSummary, fileName || "Zusammenfassung");
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
    setIsEditing(false);
    setIsEditingSecond(false);
    setSecondTabId(null);
    // Reset export state to match the history entry
    setLastExportedPageId(entry.notionPageId || null);
    setExportProgress(null);
    // Reset refine state
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

  useEffect(() => {
    if (status === "ready" && Object.keys(outputs).length > 0 && extractedText && !generatingTabId && !loadedFromHistory) {
      saveToHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputs, status, extractedText, generatingTabId, loadedFromHistory]);

  const statusClass = status === "error" ? "error" : status === "ready" ? "ready" : "busy";
  const isGenerating = generatingTabId === selectedTabId && generatingTabId !== null;
  const canGenerate = status !== "parsing" && status !== "summarizing" && !isRefining;
  const canExport = !!currentSummary && status !== "exporting";

  return (
    <div className="app">
      <div
        className={"sidebar-backdrop" + (sidebarOpen ? " visible" : "")}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
        <div className="sidebar-header">
          <h2>Historie</h2>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Sidebar schliessen"
          >
            <IconX />
          </button>
        </div>
        <div className="sidebar-content">
          {history.length === 0 ? (
            <p className="hint">Noch keine Eintraege.</p>
          ) : (
            <div className="history-groups">
              {groupHistoryByTime(history).map(([groupLabel, entries]) => (
                <div key={groupLabel}>
                  <h3 className="history-group-title">{groupLabel}</h3>
                  <ul className="history-list">
                    {entries.map((entry) => (
                      <li
                        key={entry.id}
                        className={"history-item" + (entry.id === currentHistoryId ? " active" : "")}
                        onClick={() => loadFromHistory(entry)}
                      >
                        <div className="history-item-content">
                          <strong>{entry.title}</strong>
                          {entry.exportedSubject && (
                            <span className="meta">{entry.exportedSubject}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="history-delete"
                          onClick={(e) => deleteHistoryEntry(entry.id, e)}
                          aria-label="Eintrag loeschen"
                        >
                          <IconX />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div className="header-left">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Historie oeffnen"
            >
              <IconMenu />
            </button>
            <h1 className="header-title">Summary Maker</h1>
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
            <div className="status-badge">
              <span className={"status-dot " + statusClass} />
              <span className="status-text">{statusLabels[status]}</span>
            </div>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <div className="content">
          <div className="input-panel">
            <div
              className={"dropzone" + (dragActive ? " drag" : "")}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-label">
                {fileName || "PDF hochladen"}
              </div>
              <div className="dropzone-hint">
                {fileName ? "Klicken fuer neue Datei" : "Ablegen oder klicken"}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onSelectFile}
                hidden
              />
            </div>

            <div className="field">
              <label className="field-label">Fach</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                {subjects.length === 0 ? (
                  <option value="">Keine Faecher</option>
                ) : (
                  subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Modell</label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Struktur (optional)</label>
              <textarea
                rows={2}
                placeholder="z.B. Einleitung, Begriffe"
                value={structureHints}
                onChange={(e) => setStructureHints(e.target.value)}
              />
            </div>

            {currentCost && (
              <div className="cost-preview">
                <div className="cost-preview-title">
                  Kostenvorschau
                  {isEstimating && <span className="estimating-indicator"> (berechnet...)</span>}
                </div>
                <div className="cost-row">
                  <span>Input ({formatNumber(currentCost.tokensIn)} Tokens)</span>
                  <strong>{formatMoney(currentCost.costIn, currentCost.currency)}</strong>
                </div>
                <div className="cost-row">
                  <span>
                    Output (~{formatNumber(currentCost.tokensOut)} Tokens)
                    {costHeuristic && (
                      <span className="heuristic-hint" title={`min(${costHeuristic.outputCap}, Input × ${costHeuristic.outputRatio})`}>
                        *
                      </span>
                    )}
                  </span>
                  <strong>{formatMoney(currentCost.costOut, currentCost.currency)}</strong>
                </div>
                <div className="cost-row cost-row-total">
                  <span>Gesamt</span>
                  <strong>{formatMoney(currentCost.total, currentCost.currency)}</strong>
                </div>
                {costHeuristic && (
                  <div className="cost-hint">
                    * Output-Schaetzung: min({costHeuristic.outputCap}, Input × {costHeuristic.outputRatio})
                  </div>
                )}
              </div>
            )}

            {currentUsage && (
              <div className="stats-section">
                <button
                  type="button"
                  className="stats-toggle"
                  onClick={() => setStatsOpen(!statsOpen)}
                >
                  <span>OpenRouter Stats</span>
                  <span className={"stats-toggle-icon" + (statsOpen ? " open" : "")}>
                    <IconChevron />
                  </span>
                </button>
                <div className={"stats-content" + (statsOpen ? " open" : "")}>
                  <div className="stats-grid">
                    <div className="stat">
                      <div className="stat-label">Prompt</div>
                      <div className="stat-value">{formatNumber(currentUsage.promptTokens)}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-label">Output</div>
                      <div className="stat-value">{formatNumber(currentUsage.completionTokens)}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-label">Tok/s</div>
                      <div className="stat-value">{formatNumber(currentUsage.tokensPerSecond, 1)}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-label">Dauer</div>
                      <div className="stat-value">{formatSeconds(currentUsage.durationMs)}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-label">Kosten</div>
                      <div className="stat-value">
                        {currentUsage.currency
                          ? formatMoney(currentUsage.costTotal, currentUsage.currency)
                          : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="output-panel">
            <div className="output-header">
              <div className="output-tabs">
                {outputTabs.length === 0 ? (
                  <span className="hint">Noch keine Ausgabe</span>
                ) : (
                  outputTabs.map((tab) => {
                    const isActive = tab.id === selectedTabId;
                    const isSecond = tab.id === secondTabId;
                    const isConfirming = tabToDelete === tab.id;
                    const canSplit = outputTabs.length > 1 && !isActive;
                    return (
                      <div
                        key={tab.id}
                        className={
                          "output-tab" + 
                          (isActive ? " active" : "") + 
                          (isSecond ? " split-active" : "") +
                          (tab.isGenerating ? " generating" : "")
                        }
                        onClick={(e) => handleTabChange(tab.id, e)}
                        title={canSplit ? "Ctrl+Klick für Split-View" : undefined}
                      >
                        <span className="output-tab-label">{tab.label}</span>
                        <button
                          type="button"
                          className={"output-tab-close" + (isConfirming ? " confirming" : "")}
                          onClick={(e) => handleCloseTabRequest(tab.id, e)}
                          title={isConfirming ? "Nochmal klicken zum Löschen" : "Tab schliessen"}
                        >
                          <IconClose />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="output-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  {generatingTabId ? "Generiert..." : "Generieren"}
                </button>
                {status === "exporting" && exportProgress ? (
                  <div className="export-progress">
                    <span className="export-progress-text">
                      Exportiert... {exportProgress.current}/{exportProgress.total}
                    </span>
                    <div className="export-progress-bar">
                      <div
                        className="export-progress-fill"
                        style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : lastExportedPageId ? (
                  <div className="export-actions-group">
                    <a
                      href={`https://notion.so/${lastExportedPageId.replace(/-/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      In Notion oeffnen
                    </a>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleExport}
                      disabled={!canExport}
                    >
                      Erneut
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleExport}
                    disabled={!canExport}
                  >
                    Nach Notion
                  </button>
                )}
              </div>
            </div>

            <div className={"preview-container" + (isSplitView ? " split-view" : "")}>
              {isEditing ? (
                <div className="markdown-editor">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={handleEditSave}
                    autoFocus
                  />
                </div>
              ) : isEditingSecond && isSplitView ? (
                <>
                  <div 
                    className="preview"
                    ref={previewRef1}
                  >
                    {currentOutput && (
                      <span className="preview-model-label">{currentOutput.label}</span>
                    )}
                    {currentSummary && (
                      <div className="preview-toolbar">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={handleEditStart}
                          title="Bearbeiten"
                          aria-label="Markdown bearbeiten"
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={handleCopySummary}
                          title="Kopieren"
                          aria-label="Zusammenfassung kopieren"
                        >
                          {copySuccess ? <IconCheck /> : <IconCopy />}
                        </button>
                      </div>
                    )}
                    {currentSummary ? (
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {currentSummary}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="preview-empty">
                        {extractedText
                          ? "PDF geladen. Auf Generieren klicken."
                          : "PDF hochladen, dann Generieren."}
                      </div>
                    )}
                  </div>
                  <div className="markdown-editor">
                    {secondOutput && (
                      <span className="preview-model-label">{secondOutput.label}</span>
                    )}
                    <textarea
                      value={editDraftSecond}
                      onChange={(e) => setEditDraftSecond(e.target.value)}
                      onBlur={handleEditSaveSecond}
                      autoFocus
                    />
                  </div>
                </>
              ) : (
                <>
                  <div 
                    className="preview"
                    ref={previewRef1}
                    onScroll={isSplitView ? () => handleSyncScroll(1) : undefined}
                  >
                    {isSplitView && currentOutput && (
                      <span className="preview-model-label">{currentOutput.label}</span>
                    )}
                    {currentSummary && (
                      <div className="preview-toolbar">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={handleEditStart}
                          title="Bearbeiten"
                          aria-label="Markdown bearbeiten"
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={handleCopySummary}
                          title="Kopieren"
                          aria-label="Zusammenfassung kopieren"
                        >
                          {copySuccess ? <IconCheck /> : <IconCopy />}
                        </button>
                      </div>
                    )}
                    {currentSummary ? (
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {currentSummary}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="preview-empty">
                        {extractedText
                          ? "PDF geladen. Auf Generieren klicken."
                          : "PDF hochladen, dann Generieren."}
                      </div>
                    )}
                  </div>
                  
                  {isSplitView && (
                    <div 
                      className="preview preview-second"
                      ref={previewRef2}
                      onScroll={() => handleSyncScroll(2)}
                    >
                      {secondOutput && (
                        <span className="preview-model-label">{secondOutput.label}</span>
                      )}
                      <div className="preview-toolbar">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={handleEditStartSecond}
                          title="Bearbeiten"
                          aria-label="Markdown bearbeiten"
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={handleCopySummarySecond}
                          title="Kopieren"
                          aria-label="Zusammenfassung kopieren"
                        >
                          {copySuccessSecond ? <IconCheck /> : <IconCopy />}
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-close"
                          onClick={() => setSecondTabId(null)}
                          title="Split schliessen"
                          aria-label="Split-View schliessen"
                        >
                          <IconClose />
                        </button>
                      </div>
                      {secondSummary ? (
                        <div className="markdown-content">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {secondSummary}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="preview-empty">Keine Zusammenfassung</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <form className="refine-bar" onSubmit={handleRefineSubmit}>
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Aenderung anfordern..."
                disabled={!currentSummary || isRefining}
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={!currentSummary || isRefining || !input.trim()}
              >
                {isRefining ? "Laeuft..." : "Ueberarbeiten"}
              </button>
            </form>

            <div className="bottom-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleGenerate}
                disabled={!canGenerate}
                style={{ flex: 1 }}
              >
                {generatingTabId ? "Generiert..." : "Generieren"}
              </button>
              {status === "exporting" && exportProgress ? (
                <div className="export-progress" style={{ flex: 1 }}>
                  <span className="export-progress-text">
                    {exportProgress.current}/{exportProgress.total}
                  </span>
                  <div className="export-progress-bar">
                    <div
                      className="export-progress-fill"
                      style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              ) : lastExportedPageId ? (
                <a
                  href={`https://notion.so/${lastExportedPageId.replace(/-/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  In Notion oeffnen
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExport}
                  disabled={!canExport}
                  style={{ flex: 1 }}
                >
                  Nach Notion
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
