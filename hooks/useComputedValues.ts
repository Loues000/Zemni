import { useMemo } from "react";
import type { OutputKind, OutputEntry, UsageStats, CostRow } from "@/types";

interface UseComputedValuesProps {
  chatConfig: {
    isLoading: boolean;
    messages: Array<{ role: string; content?: string }>;
    data?: any[];
  };
  modelCosts: CostRow[];
  selectedModel: string;
  currentOutput: OutputEntry | undefined;
  secondOutput: OutputEntry | undefined;
  selectedTabId: string | null;
  refineTargetRef: React.MutableRefObject<string>;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>;
}

/**
 * Computes derived values from app state
 */
export function useComputedValues({
  chatConfig,
  modelCosts,
  selectedModel,
  currentOutput,
  secondOutput,
  selectedTabId,
  refineTargetRef,
  setOutputs
}: UseComputedValuesProps) {
  const streamingRefineContent = useMemo(() => {
    if (!chatConfig.isLoading) return null;
    const assistantMessages = chatConfig.messages.filter(m => m.role === "assistant");
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    return lastAssistant?.content || null;
  }, [chatConfig.isLoading, chatConfig.messages]);

  const currentCost = useMemo(() => {
    return modelCosts.find((row) => row.id === selectedModel);
  }, [modelCosts, selectedModel]);

  const currentKind: OutputKind = useMemo(() => (currentOutput?.kind as OutputKind) || "summary", [currentOutput?.kind]);
  
  const isCurrentTabRefining = useMemo(() => chatConfig.isLoading && refineTargetRef.current === selectedTabId, [chatConfig.isLoading, selectedTabId]);
  
  const currentSummary = useMemo(() => {
    return isCurrentTabRefining && streamingRefineContent 
      ? streamingRefineContent 
      : (currentOutput?.summary ?? "");
  }, [isCurrentTabRefining, streamingRefineContent, currentOutput?.summary]);
  
  const currentUsage = useMemo(() => currentOutput?.usage ?? null, [currentOutput?.usage]);
  
  const secondSummary = useMemo(() => secondOutput?.summary ?? "", [secondOutput?.summary]);

  return {
    streamingRefineContent,
    currentCost,
    currentKind,
    isCurrentTabRefining,
    currentSummary,
    currentUsage,
    secondSummary
  };
}
