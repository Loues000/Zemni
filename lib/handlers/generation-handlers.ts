import type { Model, OutputKind, Status, OutputEntry, Flashcard, QuizQuestion, DocumentSection, UsageStats } from "@/types";
import { postJson } from "@/lib/utils/api-helpers";
import { flashcardsToMarkdown, renderQuizPreview } from "@/lib/output-previews";
import { estimateFlashcardsPerSection, estimateQuizQuestions } from "@/lib/study-heuristics";
import { createDocHash, createCacheKey, getCachedResult, setCachedResult, type CacheKey } from "@/lib/cache";
import { retryWithBackoff, isRetryableError } from "@/lib/utils/retry";
import { formatErrorMessage, getErrorInfo, isRetryableErrorMessage } from "@/lib/utils/error-messages";
import { getModelPerformanceConfig } from "@/lib/ai-performance";
import { shuffleAllQuizOptions } from "@/lib/utils/quiz-state";

const QUIZ_INITIAL_BATCH_CAP = 12;

export interface GenerationHandlersContext {
  extractedText: string;
  selectedModel: string;
  models: Model[];
  outputKind: OutputKind;
  structureHints: string;
  fileName: string;
  flashcardsDensity: number;
  docSection: DocumentSection;
  studySection: DocumentSection;
  isSmallScreen: boolean;
  selectedTabId: string | null;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>;
  setSelectedTabId: (id: string | null) => void;
  setGeneratingTabId: (id: string | null) => void;
  setError: (error: string) => void;
  setStatus: (status: Status) => void;
  setMobileView: (view: "input" | "output") => void;
  setLoadedFromHistory: (loaded: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  setData: (data: any[]) => void;
  setMessages: (messages: any[]) => void;
  setInput: (input: string) => void;
  onCacheHit?: (cached: boolean) => void; // Callback to notify UI of cache status
}

/**
 * Handles generation of summary, flashcards, or quiz
 */
export const handleGenerate = async (context: GenerationHandlersContext): Promise<void> => {
  const {
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
  } = context;

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
  const { timeoutMs } = getModelPerformanceConfig(selectedModel, extractedText.length);

  // Create cache key
  const docHash = createDocHash(extractedText, fileName);
  const cacheParams: CacheKey["params"] = {
    structureHints: outputKind === "summary" ? structureHints : undefined,
    flashcardsDensity: outputKind === "flashcards" ? flashcardsDensity : undefined,
    questionsCount: outputKind === "quiz" ? Math.min(QUIZ_INITIAL_BATCH_CAP, estimateQuizQuestions(extractedText.length)) : undefined
  };
  const cacheKeyStr = createCacheKey(docHash, outputKind, selectedModel, cacheParams);

  // Check cache first
  const cached = getCachedResult(cacheKeyStr);
  if (cached) {
    // Use cached result
    const cachedOutput: OutputEntry = {
      ...cached.output,
      id: tabId,
      modelId: selectedModel,
      label: modelLabel,
      updatedAt: Date.now(),
      isCached: true
    };

    if (isSmallScreen) setMobileView("output");
    setOutputs((prev) => ({
      ...prev,
      [tabId]: cachedOutput
    }));

    setSelectedTabId(tabId);
    setGeneratingTabId(null);
    setError("");
    setStatus("ready");
    setLoadedFromHistory(false);
    setIsEditing(false);
    setData([]);
    setMessages([]);
    setInput("");
    context.onCacheHit?.(true);
    return;
  }

  context.onCacheHit?.(false);

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
            revealAnswer: false,
            answersById: {}
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
      const data = await retryWithBackoff(
        () => postJson<{ summary: string; usage?: UsageStats | null }>(
          "/api/section-summary",
          {
            sections: [docSection],
            modelId: selectedModel,
            structure: structureHints,
            titleHint: fileName
          },
          timeoutMs
        ),
        { maxRetries: 2, initialDelayMs: 1000 }
      );

      setOutputs((prev) => {
        const output: OutputEntry = {
          ...prev[tabId],
          error: undefined,
          summary: data.summary || "",
          usage: data.usage ?? null,
          updatedAt: Date.now(),
          isGenerating: false,
          kind: "summary"
        };

        // Cache the result
        setCachedResult(cacheKeyStr, output, {
          docHash,
          mode: outputKind,
          modelId: selectedModel,
          params: cacheParams
        });

        return {
          ...prev,
          [tabId]: output
        };
      });
    } else if (outputKind === "flashcards") {
      const data = await retryWithBackoff(
        () => postJson<{ flashcards: Flashcard[]; usage?: UsageStats | null }>(
          "/api/flashcards",
          {
            sections: [studySection],
            modelId: selectedModel,
            coverageLevel: flashcardsDensity
          },
          timeoutMs
        ),
        { maxRetries: 2, initialDelayMs: 1000 }
      );
      const markdown = flashcardsToMarkdown(data.flashcards ?? [], fileName);

      setOutputs((prev) => {
        const output: OutputEntry = {
          ...prev[tabId],
          error: undefined,
          summary: markdown,
          usage: data.usage ?? null,
          updatedAt: Date.now(),
          isGenerating: false,
          kind: "flashcards",
          flashcards: data.flashcards ?? []
        };

        // Cache the result
        setCachedResult(cacheKeyStr, output, {
          docHash,
          mode: outputKind,
          modelId: selectedModel,
          params: cacheParams
        });

        return {
          ...prev,
          [tabId]: output
        };
      });
    } else if (outputKind === "quiz") {
      const data = await retryWithBackoff(
        () => postJson<{ questions: QuizQuestion[]; usage?: UsageStats | null }>(
          "/api/quiz",
          {
            section: studySection,
            modelId: selectedModel,
            questionsCount: Math.min(QUIZ_INITIAL_BATCH_CAP, estimateQuizQuestions(extractedText.length)),
            avoidQuestions: []
          },
          timeoutMs
        ),
        { maxRetries: 2, initialDelayMs: 1000 }
      );

      setOutputs((prev) => {
        const existing = prev[tabId];
        if (!existing) return prev;
        // Shuffle options to randomize correct answer position
        const shuffledQuestions = shuffleAllQuizOptions(data.questions ?? []);
        const next: OutputEntry = {
          ...existing,
          error: undefined,
          quiz: shuffledQuestions,
          usage: data.usage ?? null,
          updatedAt: Date.now(),
          isGenerating: false,
          kind: "quiz"
        };
        next.summary = renderQuizPreview(next, fileName);

        // Cache the result
        setCachedResult(cacheKeyStr, next, {
          docHash,
          mode: outputKind,
          modelId: selectedModel,
          params: cacheParams
        });

        return { ...prev, [tabId]: next };
      });
    }

    setMessages([]);
    setInput("");
    setStatus("ready");
    setGeneratingTabId(null);
  } catch (err) {
    const errorInfo = getErrorInfo(err);
    const isRetryable = errorInfo.retryable || (err instanceof Error && isRetryableError(err));

    // Keep the tab with error state for retry
    setOutputs((prev) => {
      const existing = prev[tabId];
      if (!existing) return prev;
      return {
        ...prev,
        [tabId]: {
          ...existing,
          isGenerating: false,
          error: errorInfo.message,
          errorSuggestion: errorInfo.suggestion,
          canRetry: isRetryable
        }
      };
    });

    setSelectedTabId(tabId); // Keep the failed tab selected
    setGeneratingTabId(null);
    setError(errorInfo.message);
    setStatus("error");

    // Don't switch to input view on error - let user see the error and retry
  }
};
