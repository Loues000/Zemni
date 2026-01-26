import type { OutputEntry, Status, QuizQuestion, DocumentSection } from "@/types";
import { renderQuizPreview } from "@/lib/output-previews";
import { estimateQuizQuestions } from "@/lib/study-heuristics";
import { postJson } from "@/lib/utils/api-helpers";
const QUIZ_MORE_BATCH_SIZE = 8;

export interface QuizHandlersContext {
  selectedTabId: string | null;
  outputs: Record<string, OutputEntry>;
  fileName: string;
  extractedText: string;
  studySection: DocumentSection;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>;
  setError: (error: string) => void;
  setStatus: (status: Status) => void;
  setGeneratingTabId: (id: string | null) => void;
}

/**
 * Toggles answer reveal for current quiz question
 */
export const handleQuizReveal = (context: QuizHandlersContext): void => {
  const { selectedTabId, outputs, fileName, setOutputs } = context;
  if (!selectedTabId) return;
  
  setOutputs((prev) => {
    const existing = prev[selectedTabId];
    if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
    const next: OutputEntry = {
      ...existing,
      quizState: {
        ...existing.quizState,
        revealAnswer: !existing.quizState.revealAnswer
      },
      updatedAt: Date.now()
    };
    next.summary = renderQuizPreview(next, fileName);
    return { ...prev, [selectedTabId]: next };
  });
};

/**
 * Handles option selection in quiz
 */
export const handleQuizSelectOption = (
  selectedOptionIndex: number,
  context: QuizHandlersContext
): void => {
  const { selectedTabId, outputs, fileName, setOutputs } = context;
  if (!selectedTabId) return;
  
  setOutputs((prev) => {
    const existing = prev[selectedTabId];
    if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
    const next: OutputEntry = {
      ...existing,
      quizState: {
        ...existing.quizState,
        selectedOptionIndex,
        revealAnswer: true
      },
      updatedAt: Date.now()
    };
    next.summary = renderQuizPreview(next, fileName);
    return { ...prev, [selectedTabId]: next };
  });
};

/**
 * Moves to next quiz question, loading more if needed
 */
export const handleQuizNext = async (context: QuizHandlersContext): Promise<void> => {
  const {
    selectedTabId,
    outputs,
    fileName,
    extractedText,
    studySection,
    setOutputs,
    setError,
    setStatus,
    setGeneratingTabId
  } = context;

  if (!selectedTabId) return;
  const output = outputs[selectedTabId];
  if (!output || output.kind !== "quiz" || !output.quizState) return;

  const state = output.quizState;
  const nextCursor = state.questionCursor + 1;
  const questions = output.quiz ?? [];

  if (nextCursor < questions.length) {
    setOutputs((prev) => {
      const existing = prev[selectedTabId];
      if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
      const next: OutputEntry = {
        ...existing,
        error: undefined,
        quizState: {
          ...existing.quizState,
          questionCursor: nextCursor,
          revealAnswer: false,
          selectedOptionIndex: undefined
        },
        updatedAt: Date.now()
      };
      next.summary = renderQuizPreview(next, fileName);
      return { ...prev, [selectedTabId]: next };
    });
    return;
  }

  setError("");
  setStatus("summarizing");
  setGeneratingTabId(selectedTabId);
  setOutputs((prev) => {
    const existing = prev[selectedTabId];
    if (!existing) return prev;
    return {
      ...prev,
      [selectedTabId]: {
        ...existing,
        isGenerating: true,
        error: undefined,
        summary: "# Quiz\n\nGenerating questions...\n",
        updatedAt: Date.now()
      }
    };
  });

  try {
    const avoid = (output.quiz ?? []).map((q) => q.question).filter(Boolean);
    const data = await postJson<{ questions: QuizQuestion[]; usage?: any | null }>(
      "/api/quiz",
      {
        section: studySection,
        modelId: output.modelId,
        questionsCount: Math.min(QUIZ_MORE_BATCH_SIZE, estimateQuizQuestions(extractedText.length)),
        avoidQuestions: avoid
      },
      75_000
    );

    setOutputs((prev) => {
      const existing = prev[selectedTabId];
      if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
      const appended = data.questions ?? [];
      const cursor = (existing.quiz ?? []).length;
      const next: OutputEntry = {
        ...existing,
        isGenerating: false,
        error: undefined,
        quiz: [...(existing.quiz ?? []), ...appended],
        usage: data.usage ?? existing.usage,
        quizState: {
          ...existing.quizState,
          questionCursor: cursor,
          revealAnswer: false,
          selectedOptionIndex: undefined
        },
        updatedAt: Date.now()
      };
      next.summary = renderQuizPreview(next, fileName);
      return { ...prev, [selectedTabId]: next };
    });

    setStatus("ready");
    setGeneratingTabId(null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    setError(message);
    setStatus("error");
    setGeneratingTabId(null);
    setOutputs((prev) => {
      const existing = prev[selectedTabId];
      if (!existing) return prev;
      const next: OutputEntry = {
        ...existing,
        isGenerating: false,
        error: message,
        updatedAt: Date.now()
      };
      next.summary = renderQuizPreview(next, fileName);
      return { ...prev, [selectedTabId]: next };
    });
  }
};

/**
 * Moves to previous quiz question
 */
export const handleQuizPrev = (context: QuizHandlersContext): void => {
  const { selectedTabId, outputs, fileName, setOutputs } = context;
  if (!selectedTabId) return;
  const output = outputs[selectedTabId];
  if (!output || output.kind !== "quiz" || !output.quizState) return;

  if (output.quizState.questionCursor <= 0) return;

  setOutputs((prev) => {
    const existing = prev[selectedTabId];
    if (!existing || existing.kind !== "quiz" || !existing.quizState) return prev;
    const nextCursor = Math.max(0, existing.quizState.questionCursor - 1);
    const next: OutputEntry = {
      ...existing,
      quizState: {
        ...existing.quizState,
        questionCursor: nextCursor,
        revealAnswer: false,
        selectedOptionIndex: undefined
      },
      updatedAt: Date.now()
    };
    next.summary = renderQuizPreview(next, fileName);
    return { ...prev, [selectedTabId]: next };
  });
};
