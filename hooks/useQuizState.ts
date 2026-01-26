import { useCallback } from "react";
import type { OutputEntry } from "@/types";
import {
  handleQuizReveal as handleQuizRevealHandler,
  handleQuizSelectOption as handleQuizSelectOptionHandler,
  handleQuizNext as handleQuizNextHandler,
  handleQuizPrev as handleQuizPrevHandler,
  type QuizHandlersContext
} from "@/lib/handlers/quiz-handlers";

export interface UseQuizStateReturn {
  handleQuizReveal: () => void;
  handleQuizSelectOption: (selectedOptionIndex: number) => void;
  handleQuizNext: () => Promise<void>;
  handleQuizPrev: () => void;
}

/**
 * Manages quiz-specific state and handlers
 */
export function useQuizState(
  selectedTabId: string | null,
  outputs: Record<string, OutputEntry>,
  fileName: string,
  extractedText: string,
  studySection: { id: string; title: string; text: string },
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>,
  setError: (error: string) => void,
  setStatus: (status: any) => void,
  setGeneratingTabId: (id: string | null) => void
): UseQuizStateReturn {
  const context: QuizHandlersContext = {
    selectedTabId,
    outputs,
    fileName,
    extractedText,
    studySection,
    setOutputs,
    setError,
    setStatus,
    setGeneratingTabId
  };

  const handleQuizReveal = useCallback(() => {
    handleQuizRevealHandler(context);
  }, [context]);

  const handleQuizSelectOption = useCallback((selectedOptionIndex: number) => {
    handleQuizSelectOptionHandler(selectedOptionIndex, context);
  }, [context]);

  const handleQuizNext = useCallback(async () => {
    await handleQuizNextHandler(context);
  }, [context]);

  const handleQuizPrev = useCallback(() => {
    handleQuizPrevHandler(context);
  }, [context]);

  return {
    handleQuizReveal,
    handleQuizSelectOption,
    handleQuizNext,
    handleQuizPrev
  };
}
