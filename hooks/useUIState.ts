import { useMemo } from "react";
import type { Status, OutputKind } from "@/types";

interface UseUIStateProps {
  status: Status;
  generatingTabId: string | null;
  selectedTabId: string | null;
  outputKind: OutputKind;
  currentSummary: string;
  fileHandling: { extractedText: string };
  chatConfig: { isLoading: boolean };
  selectedModel: string;
}

/**
 * Computes UI state values (button states, status indicators, etc.)
 */
export function useUIState({
  status,
  generatingTabId,
  selectedTabId,
  outputKind,
  currentSummary,
  fileHandling,
  chatConfig,
  selectedModel
}: UseUIStateProps) {
  const statusClass = useMemo(() => status === "error" ? "error" : status === "ready" ? "ready" : "busy", [status]);
  
  const statusTitle = useMemo(() => {
    return status === "parsing"
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
  }, [status]);
  
  const isGenerating = useMemo(() => generatingTabId === selectedTabId && generatingTabId !== null, [generatingTabId, selectedTabId]);
  
  const canGenerate = useMemo(() =>
    status !== "parsing" &&
    status !== "summarizing" &&
    status !== "exporting" &&
    !chatConfig.isLoading &&
    Boolean(fileHandling.extractedText) &&
    Boolean(selectedModel) &&
    !generatingTabId,
    [status, chatConfig.isLoading, fileHandling.extractedText, selectedModel, generatingTabId]
  );
  
  const canExport = useMemo(() => 
    outputKind === "summary" && 
    !!currentSummary && 
    status !== "exporting" && 
    status !== "parsing" && 
    status !== "summarizing" &&
    !chatConfig.isLoading,
    [outputKind, currentSummary, status, chatConfig.isLoading]
  );
  
  const canViewOutput = useMemo(() => Boolean(fileHandling.extractedText) && status !== "parsing", [fileHandling.extractedText, status]);

  return {
    statusClass,
    statusTitle,
    isGenerating,
    canGenerate,
    canExport,
    canViewOutput
  };
}
