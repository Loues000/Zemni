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

/**
 * Shuffle quiz question options to randomize correct answer position.
 * Uses Fisher-Yates shuffle algorithm.
 */
export const shuffleQuizOptions = (question: QuizQuestion): QuizQuestion => {
  if (!question.options || question.options.length <= 1) return question;

  const optionsWithIndex = question.options.map((opt, idx) => ({
    text: opt,
    isCorrect: idx === question.correctIndex
  }));

  // Fisher-Yates shuffle
  for (let i = optionsWithIndex.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
  }

  const newCorrectIndex = optionsWithIndex.findIndex(opt => opt.isCorrect);

  return {
    ...question,
    options: optionsWithIndex.map(opt => opt.text),
    correctIndex: newCorrectIndex
  };
};

/**
 * Shuffle options for all questions in a quiz.
 */
export const shuffleAllQuizOptions = (questions: QuizQuestion[]): QuizQuestion[] => {
  return questions.map(q => shuffleQuizOptions(q));
};
