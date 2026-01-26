import { useState, useEffect } from "react";
import type { Model, Subject, Status } from "@/types";

export interface UseAppStateReturn {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  models: Model[];
  setModels: (models: Model[]) => void;
  subjects: Subject[];
  setSubjects: (subjects: Subject[]) => void;
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  selectedSubject: string;
  setSelectedSubject: (subjectId: string) => void;
  structureHints: string;
  setStructureHints: (hints: string) => void;
  status: Status;
  setStatus: (status: Status) => void;
  error: string;
  setError: (error: string) => void;
  isCoarsePointer: boolean;
  isSmallScreen: boolean;
  statsOpen: boolean;
  setStatsOpen: (open: boolean) => void;
  defaultModel: string;
  defaultStructureHints: string;
  setDefaultModel: (modelId: string) => void;
  setDefaultStructureHints: (hints: string) => void;
}

/**
 * Manages core application state: theme, models, subjects, status, error, and UI state
 */
export function useAppState(): UseAppStateReturn {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [models, setModels] = useState<Model[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [structureHints, setStructureHints] = useState<string>("");
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState<string>("");
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [defaultStructureHints, setDefaultStructureHints] = useState<string>("");

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const update = () => setIsSmallScreen(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
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
    const saved = window.localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    if (window.innerWidth >= 769) {
      setStatsOpen(true);
    }

    // Load user settings
    const savedDefaultModel = window.localStorage.getItem("defaultModel");
    const savedDefaultStructureHints = window.localStorage.getItem("defaultStructureHints");
    if (savedDefaultModel) setDefaultModel(savedDefaultModel);
    if (savedDefaultStructureHints) setDefaultStructureHints(savedDefaultStructureHints);

    const fetchModels = async () => {
      try {
        const res = await fetch("/api/models");
        if (!res.ok) throw new Error("Could not load models.");
        const data = await res.json() as { models: Model[] };
        setModels(data.models);
        // Use saved default model or first model
        if (data.models.length > 0) {
          const modelToUse = savedDefaultModel && data.models.find(m => m.id === savedDefaultModel)
            ? savedDefaultModel
            : data.models[0].id;
          setSelectedModel(modelToUse);
        }
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
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (defaultModel) {
      window.localStorage.setItem("defaultModel", defaultModel);
    }
  }, [defaultModel]);

  useEffect(() => {
    window.localStorage.setItem("defaultStructureHints", defaultStructureHints);
  }, [defaultStructureHints]);

  return {
    theme,
    setTheme,
    models,
    setModels,
    subjects,
    setSubjects,
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
    defaultModel,
    defaultStructureHints,
    setDefaultModel,
    setDefaultStructureHints
  };
}
