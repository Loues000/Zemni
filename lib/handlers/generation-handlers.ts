import type { Model, OutputKind, Status, OutputEntry, Flashcard, QuizQuestion, DocumentSection, UsageStats } from "@/types";
import { postJson } from "@/lib/utils/api-helpers";
import { flashcardsToMarkdown, renderQuizPreview } from "@/lib/output-previews";
import { estimateFlashcardsPerSection, estimateQuizQuestions } from "@/lib/study-heuristics";

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
              revealAnswer: false
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
      const data = await postJson<{ summary: string; usage?: UsageStats | null }>(
        "/api/section-summary",
        {
          sections: [docSection],
          modelId: selectedModel,
          structure: structureHints,
          titleHint: fileName
        },
        75_000
      );

      setOutputs((prev) => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          error: undefined,
          summary: data.summary || "",
          usage: data.usage ?? null,
          updatedAt: Date.now(),
          isGenerating: false,
          kind: "summary"
        }
      }));
    } else if (outputKind === "flashcards") {
      const data = await postJson<{ flashcards: Flashcard[]; usage?: UsageStats | null }>(
        "/api/flashcards",
        {
          sections: [studySection],
          modelId: selectedModel,
          coverageLevel: flashcardsDensity
        },
        75_000
      );
      const markdown = flashcardsToMarkdown(data.flashcards ?? [], fileName);

      setOutputs((prev) => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          error: undefined,
          summary: markdown,
          usage: data.usage ?? null,
          updatedAt: Date.now(),
          isGenerating: false,
          kind: "flashcards",
          flashcards: data.flashcards ?? []
        }
      }));
    } else if (outputKind === "quiz") {
      const data = await postJson<{ questions: QuizQuestion[]; usage?: UsageStats | null }>(
        "/api/quiz",
        {
          section: studySection,
          modelId: selectedModel,
          questionsCount: Math.min(QUIZ_INITIAL_BATCH_CAP, estimateQuizQuestions(extractedText.length)),
          avoidQuestions: []
        },
        75_000
      );

      setOutputs((prev) => {
        const existing = prev[tabId];
        if (!existing) return prev;
        const next: OutputEntry = {
          ...existing,
          error: undefined,
          quiz: data.questions ?? [],
          usage: data.usage ?? null,
          updatedAt: Date.now(),
          isGenerating: false,
          kind: "quiz"
        };
        next.summary = renderQuizPreview(next, fileName);
        return { ...prev, [tabId]: next };
      });
    }

    setMessages([]);
    setInput("");
    setStatus("ready");
    setGeneratingTabId(null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    setOutputs((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setSelectedTabId(previousTabId);
    if (isSmallScreen) setMobileView("input");
    setError(message);
    setStatus("error");
    setGeneratingTabId(null);
  }
};
