"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import { 
  HistorySidebar, 
  InputPanel, 
  OutputTabs, 
  SummaryPreview, 
  RefineBar 
} from "@/components/features";
import { StatusBadge, CostPreview, StatsSection, IconMenu, IconSun, IconMoon } from "@/components/ui";
import type { 
  Model, 
  Subject, 
  Status, 
  UsageStats, 
  OutputEntry, 
  HistoryEntry,
  CostRow 
} from "@/types";
import { useHistory, useTokenEstimate } from "@/hooks";
import { enforceOutputFormat } from "@/lib/format-output";

const getSummaryTitle = (summary: string, fallback: string): string => {
  const match = summary.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fallback;
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

  const outputTabs = useMemo(() => {
    return Object.values(outputs).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [outputs]);

  const currentOutput = selectedTabId ? outputs[selectedTabId] : undefined;
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
        const data = await res.json() as { models: Model[] };
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
        const data = await res.json() as { subjects: Subject[] };
        setSubjects(data.subjects);
        if (data.subjects.length > 0) setSelectedSubject(data.subjects[0].id);
      } catch (err) {
        // Ignore
      }
    };

    fetchModels();
    fetchSubjects();
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

  useEffect(() => {
    if (!extractedText) {
      setModelCosts([]);
      setCostHeuristic(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchTokenEstimate(extractedText, structureHints);
    }, 300);

    return () => clearTimeout(timer);
  }, [extractedText, structureHints, fetchTokenEstimate]);

  useEffect(() => {
    if (status === "ready" && Object.keys(outputs).length > 0 && extractedText && !generatingTabId && !loadedFromHistory) {
      saveToHistory();
    }
  }, [outputs, status, extractedText, generatingTabId, loadedFromHistory]);

  const handleTabChange = (tabId: string, event?: React.MouseEvent): void => {
    const isCtrlClick = event && (event.ctrlKey || event.metaKey);
    
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
    
    if (tabToDelete === tabId) {
      handleCloseTabConfirm(tabId);
      return;
    }
    
    setTabToDelete(tabId);
    
    setTimeout(() => {
      setTabToDelete((current) => current === tabId ? null : current);
    }, 3000);
  };

  const handleCloseTabConfirm = (tabId: string): void => {
    setTabToDelete(null);
    
    if (tabId === secondTabId) {
      setSecondTabId(null);
      return;
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
            const clientMessage = parseError instanceof Error ? parseError.message : "Unbekannter Fehler";
            throw new Error(`Client-Parsing fehlgeschlagen. Server-Fallback fehlgeschlagen. (${clientMessage})`);
          }
          const data = await res.json() as { text: string };
          normalizedText = data.text ?? "";
        }
      } else {
        extractedText = await file.text();
      }

      if (normalizedText === null) {
        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: extractedText })
        });

        if (!res.ok) throw new Error("Text konnte nicht normalisiert werden.");

        const data = await res.json() as { text: string };
        normalizedText = data.text ?? "";
      }

      setExtractedText(normalizedText);
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
    
    const tabId = selectedModel + "-" + Date.now();
    const modelLabel = models.find(m => m.id === selectedModel)?.displayName || selectedModel;
    
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
      const data = await res.json() as { summary: string; usage?: UsageStats | null };
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
            if (parseErr instanceof Error && parseErr.message !== "Export fehlgeschlagen") {
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
  const isGenerating = generatingTabId === selectedTabId && generatingTabId !== null;
  const canGenerate = status !== "parsing" && status !== "summarizing" && !isRefining;
  const canExport = !!currentSummary && status !== "exporting";

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
            <StatusBadge status={status} />
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <div className="content">
          <InputPanel
            fileName={fileName}
            selectedSubject={selectedSubject}
            subjects={subjects}
            selectedModel={selectedModel}
            models={models}
            structureHints={structureHints}
            dragActive={dragActive}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onSelectFile={onSelectFile}
            onSubjectChange={setSelectedSubject}
            onModelChange={handleModelChange}
            onStructureChange={setStructureHints}
          >
            <CostPreview
              currentCost={currentCost}
              isEstimating={isEstimating}
              costHeuristic={costHeuristic}
            />
            <StatsSection
              currentUsage={currentUsage}
              isOpen={statsOpen}
              onToggle={() => setStatsOpen(!statsOpen)}
            />
          </InputPanel>

          <div className="output-panel">
            <div className="output-header">
              <OutputTabs
                outputs={outputs}
                selectedTabId={selectedTabId}
                secondTabId={secondTabId}
                generatingTabId={generatingTabId}
                tabToDelete={tabToDelete}
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

              <RefineBar
                input={input}
                isRefining={isRefining}
                hasCurrentSummary={!!currentSummary}
                onInputChange={handleInputChange}
                onSubmit={handleRefineSubmit}
              />

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
