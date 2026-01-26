import { useCallback, useMemo } from "react";
import type { OutputKind, DocumentSection, Model } from "@/types";
import { handleGenerate as handleGenerateHandler, type GenerationHandlersContext } from "@/lib/handlers/generation-handlers";
import { handleRetryGeneration } from "@/lib/handlers/retry-handlers";
import { trimForModel } from "@/lib/utils/text-processing";

export interface UseGenerationReturn {
  docSection: DocumentSection;
  studySection: DocumentSection;
  textForEstimate: string;
  handleGenerate: () => Promise<void>;
  handleRetry: (tabId: string, outputs: Record<string, any>) => Promise<void>;
  generationContext: GenerationHandlersContext;
}

/**
 * Manages summary/flashcards/quiz generation logic
 */
export function useGeneration(
  fileName: string,
  extractedText: string,
  outputKind: OutputKind,
  selectedModel: string,
  models: Model[],
  structureHints: string,
  flashcardsDensity: number,
  isSmallScreen: boolean,
  selectedTabId: string | null,
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  setSelectedTabId: (id: string | null) => void,
  setGeneratingTabId: (id: string | null) => void,
  setError: (error: string) => void,
  setStatus: (status: any) => void,
  setMobileView: (view: "input" | "output") => void,
  setLoadedFromHistory: (loaded: boolean) => void,
  setIsEditing: (editing: boolean) => void,
  setData: (data: any[]) => void,
  setMessages: (messages: any[]) => void,
  setInput: (input: string) => void
): UseGenerationReturn {
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

  const context: GenerationHandlersContext = {
    extractedText,
    selectedModel,
    models,
    outputKind,
    structureHints,
    fileName,
    flashcardsDensity,
    docSection,
    studySection,
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
  };

  const handleGenerate = useCallback(async () => {
    await handleGenerateHandler(context);
  }, [context]);

  const handleRetry = useCallback(async (tabId: string, outputs: Record<string, any>) => {
    await handleRetryGeneration(tabId, context, outputs);
  }, [context]);

  return {
    docSection,
    studySection,
    textForEstimate,
    handleGenerate,
    handleRetry,
    generationContext: context
  };
}
