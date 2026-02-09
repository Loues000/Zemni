export type Pricing = {
  currency: string;
  input_per_1m: number | null;
  output_per_1m: number | null;
};

export type Model = {
  id: string;
  name: string;
  provider: string;
  displayName: string;
  tokenizer: string;
  pricing: Pricing;
  subscriptionTier?: string;
  isAvailable?: boolean;
  requiredTier?: string;
  isCoveredBySubscription?: boolean;
  requiresOwnKey?: boolean;
  description?: string;
};

export type CostRow = {
  id: string;
  name: string;
  provider: string;
  tokenizer: string;
  tokensIn: number;
  tokensOut: number;
  costIn: number | null;
  costOut: number | null;
  total: number | null;
  currency: string;
  inPer1m: number | null;
  outPer1m: number | null;
};

export type Subject = {
  id: string;
  title: string;
};

export type Status = "idle" | "parsing" | "summarizing" | "refining" | "exporting" | "error" | "ready";

export type OutputKind = "summary" | "flashcards" | "quiz";

export type DocumentSection = {
  id: string;
  title: string;
  text: string;
  page?: number;
  preview?: string;
};

export type Flashcard = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  type: "qa" | "cloze";
  front: string;
  back: string;
  sourceSnippet: string;
  page?: number;
};

export type QuizQuestion = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  sourceSnippet: string;
  page?: number;
};

export type QuizAnswerState = {
  selectedOptionIndex?: number;
  revealAnswer?: boolean;
};

export type QuizState = {
  questionCursor: number;
  revealAnswer?: boolean;
  selectedOptionIndex?: number;
  answersById?: Record<string, QuizAnswerState>;
};

export type UsageStats = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  tokensPerSecond: number | null;
  costIn: number | null;
  costOut: number | null;
  costTotal: number | null;
  currency: string | null;
  source: "summarize" | "refine" | "section-summary" | "flashcards" | "quiz";
};

export type OutputEntry = {
  id: string;
  modelId: string;
  label: string;
  summary: string;
  usage: UsageStats | null;
  updatedAt: number;
  isGenerating?: boolean;
  error?: string;
  errorSuggestion?: string; // Actionable suggestion for the error
  canRetry?: boolean; // Indicates if the error is retryable
  isCached?: boolean; // Indicates if this result came from cache
  kind?: OutputKind;
  sectionIds?: string[];
  flashcards?: Flashcard[];
  quiz?: QuizQuestion[];
  quizState?: QuizState;
};

export type HistoryEntry = {
  id: string;
  title: string;
  fileName: string;
  extractedText: string;
  outputs: Record<string, OutputEntry>;
  structureHints: string;
  createdAt: number;
  updatedAt: number;
  exportedSubject?: string;
  notionPageId?: string;
};

export type CostHeuristic = {
  outputRatio: number;
  outputCap: number;
  estimatedOutputTokens: number;
  note?: string;
};
