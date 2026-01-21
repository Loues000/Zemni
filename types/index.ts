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
  source: "summarize" | "refine";
};

export type OutputEntry = {
  id: string;
  modelId: string;
  label: string;
  summary: string;
  usage: UsageStats | null;
  updatedAt: number;
  isGenerating?: boolean;
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
};
