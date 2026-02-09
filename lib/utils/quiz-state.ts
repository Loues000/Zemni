import type { QuizAnswerState, QuizQuestion, QuizState } from "@/types";

/**
 * Build a stable key for a quiz question within a session.
 */
export const getQuizQuestionKey = (question: QuizQuestion | undefined, index: number): string => {
  if (question?.id) return question.id;
  return `idx:${index}`;
};

/**
 * Read the persisted answer state for a specific question.
 */
export const getQuizAnswerState = (
  state: QuizState | undefined,
  question: QuizQuestion | undefined,
  index: number
): QuizAnswerState | undefined => {
  if (!state) return undefined;
  const key = getQuizQuestionKey(question, index);
  return state.answersById?.[key];
};
