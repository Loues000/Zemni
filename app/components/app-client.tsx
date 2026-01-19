"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const refineTargetRef = useRef<string>("");

  const chatConfig = useChat({
    api: "/api/refine",
    onFinish: (message: { content: string }) => {
      const targetTabId = refineTargetRef.current;
      if (targetTabId) {
        setOutputs((prev) => {
          const existing = prev[targetTabId];
          if (!existing) return prev;
          return {
            ...prev,
            [targetTabId]: {
              ...existing,
              summary: message.content,
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

  const currentCost = useMemo(() => {
    return modelCosts.find((row) => row.id === selectedModel);
  }, [modelCosts, selectedModel]);

  const outputTabs = useMemo(() => {
    return Object.values(outputs).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [outputs]);

  const currentOutput = selectedTabId ? outputs[selectedTabId] : undefined;
  const currentSummary = currentOutput?.summary ?? "";
  const currentUsage = currentOutput?.usage ?? null;

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

  const handleTabChange = (tabId: string): void => {
    setSelectedTabId(tabId);
    setIsEditing(false);
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

  const handleModelChange = (modelId: string): void => {
    setSelectedModel(modelId);
  };

  const handleFile = async (file: File): Promise<void> => {
    setError("");
    setStatus("parsing");
    setFileName(file.name);
    setOutputs({});
    setSelectedTabId(null);
    setGeneratingTabId(null);
    setLoadedFromHistory(false);
    setCurrentHistoryId(null);
    setMessages([]);
    setInput("");
    setData([]);
    setIsEditing(false);
    refineTargetRef.current = "";
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("PDF konnte nicht verarbeitet werden.");
      const data = (await res.json()) as { text: string; modelCosts: CostRow[] };
      setExtractedText(data.text || "");
      setModelCosts(data.modelCosts || []);
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
    try {
      const title = getSummaryTitle(currentSummary, fileName || "Zusammenfassung");
      const res = await fetch("/api/notion/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: selectedSubject,
          title,
          markdown: currentSummary
        })
      });
      if (!res.ok) throw new Error("Notion Export fehlgeschlagen.");
      setStatus("ready");
      const subjectTitle = subjects.find((s) => s.id === selectedSubject)?.title;
      setLoadedFromHistory(false);
      if (outputs && extractedText && subjectTitle) {
        saveToHistory(undefined, subjectTitle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("error");
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

  const saveToHistory = (outputsToSave?: Record<string, OutputEntry>, exportedSubjectTitle?: string): void => {
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
        exportedSubject: finalExportedSubject
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
                <div className="cost-preview-title">Kostenvorschau</div>
                <div className="cost-row">
                  <span>Input</span>
                  <strong>{formatMoney(currentCost.costIn, currentCost.currency)}</strong>
                </div>
                <div className="cost-row">
                  <span>Output (geschaetzt)</span>
                  <strong>{formatMoney(currentCost.costOut, currentCost.currency)}</strong>
                </div>
                <div className="cost-row">
                  <span>Gesamt</span>
                  <strong>{formatMoney(currentCost.total, currentCost.currency)}</strong>
                </div>
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
                  outputTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={"output-tab" + (tab.id === selectedTabId ? " active" : "") + (tab.isGenerating ? " generating" : "")}
                      onClick={() => handleTabChange(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))
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
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleExport}
                  disabled={!canExport}
                >
                  Nach Notion
                </button>
              </div>
            </div>

            <div className="preview-container">
              {isEditing ? (
                <div className="markdown-editor">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={handleEditSave}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="preview">
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExport}
                disabled={!canExport}
                style={{ flex: 1 }}
              >
                Nach Notion
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
