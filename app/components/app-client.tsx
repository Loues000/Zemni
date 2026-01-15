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
  modelId: string;
  label: string;
  summary: string;
  usage: UsageStats | null;
  updatedAt: number;
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
  exportedSubject?: string; // Subject title if exported to Notion
};

const statusLabels: Record<Status, string> = {
  idle: "Bereit",
  parsing: "PDF lesen",
  summarizing: "Zusammenfassung",
  refining: "Verfeinerung",
  exporting: "Notion Export",
  error: "Fehler",
  ready: "Bereit"
};

const formatMoney = (value: number | null, currency: string) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(4)} ${currency}`;
};

const formatNumber = (value: number | null, digits = 0) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const formatSeconds = (ms: number | null) => {
  if (!ms) {
    return "--";
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

const getSummaryTitle = (summary: string, fallback: string) => {
  const match = summary.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fallback;
};

const getModelLabel = (models: Model[], modelId: string) => {
  const model = models.find((item) => item.id === modelId);
  return model ? model.displayName : modelId;
};

// Create a simple hash from string for PDF identification
const createPdfId = (fileName: string, extractedText: string): string => {
  const content = `${fileName}:${extractedText.slice(0, 1000)}`; // Use first 1000 chars for hash
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `pdf-${Math.abs(hash).toString(36)}`;
};

const HISTORY_STORAGE_KEY = "summary-maker-history-v1";

const sortHistory = (entries: HistoryEntry[]) => {
  return entries.slice().sort((a, b) => b.updatedAt - a.updatedAt);
};

const isHistoryEntry = (value: unknown): value is HistoryEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }
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
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sortHistory(parsed.filter(isHistoryEntry));
  } catch (err) {
    return [];
  }
};

const saveHistoryToStorage = (entries: HistoryEntry[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    // Ignore storage errors
  }
};

// Group history entries by time periods
const groupHistoryByTime = (history: HistoryEntry[]) => {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = todayStart - 30 * 24 * 60 * 60 * 1000;

  const groups: Record<string, HistoryEntry[]> = {
    heute: [],
    gestern: [],
    "letzte 7 tage": [],
    "letzte 30 tage": [],
    älter: []
  };

  history.forEach((entry) => {
    const updatedAt = entry.updatedAt;
    if (updatedAt >= todayStart) {
      groups.heute.push(entry);
    } else if (updatedAt >= yesterdayStart) {
      groups.gestern.push(entry);
    } else if (updatedAt >= weekAgo) {
      groups["letzte 7 tage"].push(entry);
    } else if (updatedAt >= monthAgo) {
      groups["letzte 30 tage"].push(entry);
    } else {
      groups.älter.push(entry);
    }
  });

  // Remove empty groups
  return Object.entries(groups).filter(([_, entries]) => entries.length > 0);
};

export default function AppClient() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [models, setModels] = useState<Model[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [structureHints, setStructureHints] = useState<string>("");
  const [status, setStatus] = useState<Status>("ready");
  const [generatingModelId, setGeneratingModelId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [modelCosts, setModelCosts] = useState<CostRow[]>([]);
  const [outputs, setOutputs] = useState<Record<string, OutputEntry>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const refineTargetRef = useRef<string>("");

  const {
    input,
    handleInputChange,
    handleSubmit,
    isLoading: isRefining,
    data: chatData,
    setData,
    setMessages,
    setInput
  } = useChat({
    api: "/api/refine",
    onFinish: (message: { content: string }) => {
      const targetModelId = refineTargetRef.current || selectedModel;
      if (targetModelId) {
        const label = getModelLabel(models, targetModelId);
        setOutputs((prev) => {
          const existing = prev[targetModelId];
          return {
            ...prev,
            [targetModelId]: {
              modelId: targetModelId,
              label,
              summary: message.content,
              usage: existing?.usage ?? null,
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

  const currentCost = useMemo(() => {
    return modelCosts.find((row) => row.id === selectedModel);
  }, [modelCosts, selectedModel]);

  const outputTabs = useMemo(() => {
    return Object.values(outputs).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [outputs]);

  const currentOutput = selectedModel ? outputs[selectedModel] : undefined;
  const currentSummary = currentOutput?.summary ?? "";
  const currentUsage = currentOutput?.usage ?? null;

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    const fetchModels = async () => {
      try {
        const res = await fetch("/api/models");
        if (!res.ok) {
          throw new Error("Modelle konnten nicht geladen werden.");
        }
        const data = (await res.json()) as { models: Model[] };
        setModels(data.models);
        if (data.models.length > 0) {
          setSelectedModel(data.models[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        setStatus("error");
      }
    };

    const fetchSubjects = async () => {
      try {
        const res = await fetch("/api/notion/subjects");
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as { subjects: Subject[] };
        setSubjects(data.subjects);
        if (data.subjects.length > 0) {
          setSelectedSubject(data.subjects[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        setStatus("error");
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
    if (!chatData?.length) {
      return;
    }
    const latest = [...chatData].reverse().find((item) => {
      return typeof item === "object" && item !== null && (item as any).type === "usage";
    }) as { payload?: UsageStats } | undefined;

    if (latest?.payload) {
      const targetModelId = refineTargetRef.current || selectedModel;
      if (!targetModelId) {
        return;
      }
      const label = getModelLabel(models, targetModelId);
      setOutputs((prev) => {
        const existing = prev[targetModelId];
        return {
          ...prev,
          [targetModelId]: {
            modelId: targetModelId,
            label: existing?.label ?? label,
            summary: existing?.summary ?? "",
            usage: latest.payload ?? null,
            updatedAt: existing?.updatedAt ?? Date.now()
          }
        };
      });
    }
  }, [chatData, models, selectedModel]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    // Only clear chat-related state if we're not generating (to allow viewing other models during generation)
    if (!generatingModelId) {
      setError("");
      setMessages([]);
      setInput("");
      setData([]);
    } else if (modelId !== generatingModelId) {
      // If switching to a different model during generation, just clear chat state
      // but keep the generating state for the other model
      setError("");
      setMessages([]);
      setInput("");
      setData([]);
    }
  };

  const handleFile = async (file: File) => {
    setError("");
    setStatus("parsing");
    setFileName(file.name);
    setOutputs({});
    setGeneratingModelId(null);
    setLoadedFromHistory(false);
    setCurrentHistoryId(null);
    setMessages([]);
    setInput("");
    setData([]);
    refineTargetRef.current = "";
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        throw new Error("PDF konnte nicht verarbeitet werden.");
      }
      const data = (await res.json()) as { text: string; modelCosts: CostRow[] };
      setExtractedText(data.text || "");
      setModelCosts(data.modelCosts || []);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("error");
    }
  };

  const handleGenerate = async () => {
    if (!extractedText) {
      setError("Bitte zuerst ein PDF hochladen.");
      setStatus("error");
      return;
    }
    if (!selectedModel) {
      setError("Bitte ein KI-Modell auswaehlen.");
      setStatus("error");
      return;
    }
    setError("");
    setStatus("summarizing");
    setGeneratingModelId(selectedModel);
    setLoadedFromHistory(false); // Reset flag when generating, so changes will be saved
    setData([]);
    try {
      const modelLabel = getModelLabel(models, selectedModel);
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractedText,
          modelId: selectedModel,
          structure: structureHints
        })
      });
      if (!res.ok) {
        throw new Error("Zusammenfassung konnte nicht erstellt werden.");
      }
      const data = (await res.json()) as { summary: string; usage?: UsageStats | null };
      setOutputs((prev) => ({
        ...prev,
        [selectedModel]: {
          modelId: selectedModel,
          label: modelLabel,
          summary: data.summary || "",
          usage: data.usage ?? null,
          updatedAt: Date.now()
        }
      }));
      setMessages([]);
      setInput("");
      setStatus("ready");
      setGeneratingModelId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("error");
      setGeneratingModelId(null);
    }
  };

  const handleExport = async () => {
    if (!currentSummary) {
      setError("Es gibt keine Zusammenfassung zum Export.");
      setStatus("error");
      return;
    }
    if (!selectedSubject) {
      setError("Bitte ein Fach auswaehlen.");
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
      if (!res.ok) {
        throw new Error("Notion Export fehlgeschlagen.");
      }
      setStatus("ready");
      // Get subject title for history - MUST be found since we checked selectedSubject above
      const subjectTitle = subjects.find((s) => s.id === selectedSubject)?.title;
      // Save to history after export - explicitly update with exported subject
      // Export counts as a change, so reset the flag
      setLoadedFromHistory(false);
      if (outputs && extractedText && subjectTitle) {
        void saveToHistory(undefined, subjectTitle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("error");
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => {
    setDragActive(false);
  };

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleRefineSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentSummary || !selectedModel) {
      setError("Keine Zusammenfassung fuer dieses Modell vorhanden.");
      setStatus("error");
      return;
    }
    setStatus("refining");
    setLoadedFromHistory(false); // Reset flag when refining, so changes will be saved
    refineTargetRef.current = selectedModel;
    setData([]);
    handleSubmit(event, {
      body: {
        summary: currentSummary,
        modelId: selectedModel
      }
    });
  };

  const statsLabel = currentUsage
    ? currentUsage.source === "refine"
      ? "Letzte Verfeinerung"
      : "Letzte Zusammenfassung"
    : "Noch keine OpenRouter-Stats";

  const updateHistoryState = (updater: (prev: HistoryEntry[]) => HistoryEntry[]) => {
    setHistory((prev) => {
      const next = sortHistory(updater(prev));
      saveHistoryToStorage(next);
      return next;
    });
  };

  const saveToHistory = (outputsToSave?: Record<string, OutputEntry>, exportedSubjectTitle?: string) => {
    const outputsData = outputsToSave || outputs;
    if (!extractedText || Object.keys(outputsData).length === 0) {
      return;
    }

    const firstSummary = Object.values(outputsData)[0]?.summary || "";
    const title = getSummaryTitle(firstSummary, fileName || "Zusammenfassung");

    // Create PDF-based ID to group entries from the same PDF
    const pdfId = createPdfId(fileName || "untitled", extractedText);

    // Use existing history ID if we loaded from history, otherwise use PDF ID
    const historyId = currentHistoryId || pdfId;
    const now = Date.now();

    updateHistoryState((prev) => {
      const existingEntry = prev.find((h) => {
        const hPdfId = createPdfId(h.fileName, h.extractedText);
        return hPdfId === pdfId;
      });

      // Determine exportedSubject: use new one if provided, otherwise keep existing
      let finalExportedSubject: string | undefined;
      if (exportedSubjectTitle !== undefined) {
        // Explicitly provided (could be undefined if export failed or no subject selected)
        // If it's a non-empty string, use it; if undefined/empty, clear it
        finalExportedSubject = exportedSubjectTitle || undefined;
      } else {
        // Not provided in this call, keep existing
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
        if (item.id === entry.id) {
          return false;
        }
        if (existingEntry && item.id === existingEntry.id) {
          return false;
        }
        return true;
      });

      return [entry, ...filtered];
    });

    if (!currentHistoryId) {
      setCurrentHistoryId(historyId);
    }
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setFileName(entry.fileName);
    setExtractedText(entry.extractedText);
    setOutputs(entry.outputs);
    setStructureHints(entry.structureHints);
    setCurrentHistoryId(entry.id);
    setLoadedFromHistory(true);
    setError("");
    setSidebarOpen(false);
    // Set first model as selected if available
    const firstModelId = Object.keys(entry.outputs)[0];
    if (firstModelId) {
      setSelectedModel(firstModelId);
    }
  };

  const deleteHistoryEntry = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    updateHistoryState((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleCopySummary = async () => {
    if (!currentSummary) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentSummary);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback for older browsers
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
      } catch (err) {
        // Ignore
      }
      document.body.removeChild(textArea);
    }
  };

  // Save to history after generating (only if not loaded from history)
  useEffect(() => {
    if (status === "ready" && Object.keys(outputs).length > 0 && extractedText && !generatingModelId && !loadedFromHistory) {
      void saveToHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputs, status, extractedText, generatingModelId, loadedFromHistory]);

  return (
    <main className={sidebarOpen ? "sidebar-open" : ""}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Historie</h2>
        </div>
        <div className="sidebar-content">
          {history.length === 0 ? (
            <div className="hint">Noch keine Historie vorhanden.</div>
          ) : (
            <div className="history-groups">
              {groupHistoryByTime(history).map(([groupLabel, entries]) => (
                <div key={groupLabel} className="history-group">
                  <h3 className="history-group-title">{groupLabel}</h3>
                  <ul className="history-list">
                    {entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="history-item"
                        onClick={() => void loadFromHistory(entry)}
                      >
                        <div className="history-item-content">
                          <strong>{entry.title}</strong>
                          {entry.exportedSubject && (
                            <span className="hint">{entry.exportedSubject}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="history-delete"
                          onClick={(e) => void deleteHistoryEntry(entry.id, e)}
                        >
                          ×
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
      <div className="page">
        <header className="header">
          <div className="header-title">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--stroke)", background: "var(--surface-muted)", fontSize: "16px", lineHeight: 1 }}
            >
              {sidebarOpen ? "←" : "→"}
            </button>
            <div>
              <h1>Summary Maker</h1>
              <span>PDF rein, Zusammenfassung raus, Notion ready.</span>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            <div className="status">
              <span
                className={`status-dot ${
                  status === "error" ? "error" : status === "ready" ? "ready" : "busy"
                }`}
              />
              {statusLabels[status]}
            </div>
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}

        <section className="config">
          <div className="field">
            <label>Fach (Notion)</label>
            <select
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
            >
              {subjects.length === 0 ? (
                <option value="">Keine Notion-Seiten gefunden</option>
              ) : null}
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
            <span className="hint">Ziel ist eine neue Unterseite im Fach.</span>
          </div>

          <div className="field">
            <label>KI-Modell (OpenRouter)</label>
            <select
              value={selectedModel}
              onChange={(event) => handleModelChange(event.target.value)}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
            <span className="hint">
              {selectedModel ? `ID: ${selectedModel}` : "Bitte Modell waehlen"}
            </span>
          </div>

          <div className="field">
            <label>Strukturvorgaben (optional)</label>
            <textarea
              rows={3}
              placeholder="z.B. Einleitung, Begriffe, Beispiele"
              value={structureHints}
              onChange={(event) => setStructureHints(event.target.value)}
            />
          </div>
        </section>

        <section className="grid">
          <div className="panel">
            <h2>Input & Kosten</h2>
            <div
              className={`dropzone ${dragActive ? "drag" : ""}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <strong>PDF hier ablegen</strong>
              <span>oder klicken, um eine Datei auszuwaehlen</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onSelectFile}
                hidden
              />
            </div>

            <div className="cost-box">
              <strong>Kosten-Vorschau</strong>
              <div>Datei: {fileName || "--"}</div>
              <div>Input Tokens: {currentCost ? currentCost.tokensIn.toLocaleString() : "--"}</div>
              <div>Input Kosten: {currentCost ? formatMoney(currentCost.costIn, currentCost.currency) : "--"}</div>
              <div>Output Tokens: {currentCost ? currentCost.tokensOut.toLocaleString() : "--"}</div>
              <div>Output Kosten: {currentCost ? formatMoney(currentCost.costOut, currentCost.currency) : "--"}</div>
              <div>Gesamt: {currentCost ? formatMoney(currentCost.total, currentCost.currency) : "--"}</div>
            </div>

            <div className="stats">
              <div className="stats-header">
                <strong>OpenRouter Stats</strong>
                <span className="hint">{statsLabel}</span>
              </div>
              <div className="stats-grid">
                <div className="stat">
                  <span>Prompt Tokens</span>
                  <strong>{formatNumber(currentUsage?.promptTokens ?? null)}</strong>
                </div>
                <div className="stat">
                  <span>Output Tokens</span>
                  <strong>{formatNumber(currentUsage?.completionTokens ?? null)}</strong>
                </div>
                <div className="stat">
                  <span>Total Tokens</span>
                  <strong>{formatNumber(currentUsage?.totalTokens ?? null)}</strong>
                </div>
                <div className="stat">
                  <span>Tokens/sec</span>
                  <strong>{formatNumber(currentUsage?.tokensPerSecond ?? null, 1)}</strong>
                </div>
                <div className="stat">
                  <span>Dauer</span>
                  <strong>{formatSeconds(currentUsage?.durationMs ?? null)}</strong>
                </div>
                <div className="stat">
                  <span>Kosten In</span>
                  <strong>
                    {currentUsage?.currency
                      ? formatMoney(currentUsage.costIn, currentUsage.currency)
                      : "--"}
                  </strong>
                </div>
                <div className="stat">
                  <span>Kosten Out</span>
                  <strong>
                    {currentUsage?.currency
                      ? formatMoney(currentUsage.costOut, currentUsage.currency)
                      : "--"}
                  </strong>
                </div>
                <div className="stat">
                  <span>Kosten Total</span>
                  <strong>
                    {currentUsage?.currency
                      ? formatMoney(currentUsage.costTotal, currentUsage.currency)
                      : "--"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="hint">
              Token-Logik basiert auf der PDF-Quelle, ohne KI-Vorgaben.
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Output & Review</h2>
              <div className="panel-actions">
                <button
                  className="button secondary"
                  onClick={handleGenerate}
                  disabled={status === "parsing" || isRefining || (generatingModelId !== null && generatingModelId === selectedModel)}
                >
                  {generatingModelId === selectedModel ? "Wird generiert..." : "Zusammenfassung erzeugen"}
                </button>
                <button
                  className="button primary"
                  onClick={handleExport}
                  disabled={status === "exporting" || !currentSummary}
                >
                  Final nach Notion exportieren
                </button>
              </div>
            </div>
            <div className="output-tabs">
              {outputTabs.length === 0 ? (
                <span className="hint">Noch keine Modell-Ausgaben vorhanden.</span>
              ) : (
                outputTabs.map((tab) => (
                  <button
                    key={tab.modelId}
                    className={`output-tab ${tab.modelId === selectedModel ? "active" : ""} ${tab.modelId === generatingModelId ? "generating" : ""}`}
                    type="button"
                    onClick={() => handleModelChange(tab.modelId)}
                  >
                    {tab.label}
                    {tab.modelId === generatingModelId && " ⏳"}
                  </button>
                ))
              )}
            </div>
            <div className="preview">
              <button
                type="button"
                className="copy-button"
                onClick={handleCopySummary}
                disabled={!currentSummary}
                title="Zusammenfassung kopieren"
              >
                {copySuccess ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
              {currentSummary ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {currentSummary}
                </ReactMarkdown>
              ) : (
                <span className="hint">
                  {selectedModel
                    ? "Fuer dieses Modell gibt es noch keine Zusammenfassung."
                    : "Noch keine Zusammenfassung erzeugt."}
                </span>
              )}
            </div>

            <form className="chat" onSubmit={handleRefineSubmit}>
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Aenderung anfordern, z.B. kuerzer oder genauer..."
                disabled={!currentSummary || isRefining}
              />
              <button
                className="button secondary"
                type="submit"
                disabled={!currentSummary || isRefining}
              >
                Ueberarbeiten
              </button>
            </form>
          </div>
        </section>

        <section className="actions">
          <button
            className="button secondary"
            onClick={handleGenerate}
            disabled={status === "parsing" || isRefining || (generatingModelId !== null && generatingModelId === selectedModel)}
          >
            {generatingModelId === selectedModel ? "Wird generiert..." : "Zusammenfassung erzeugen"}
          </button>
          <button
            className="button primary"
            onClick={handleExport}
            disabled={status === "exporting" || !currentSummary}
          >
            Final nach Notion exportieren
          </button>
        </section>
      </div>
    </main>
  );
}
