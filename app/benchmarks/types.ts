export interface BenchmarkResult {
  model_id: string;
  task: string;
  test_case_id: string;
  test_case_topic?: string;
  test_case_format?: string;
  reliability_score: number;
  content_quality_score: number;
  cost: number;
  latency_ms: number;
  output_text?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  judge_cost?: number;
  total_judge_cost?: number;
}

export interface ModelMetrics {
  reliability: { mean: number; std_dev: number };
  content_quality: { mean: number; std_dev: number };
  factual_accuracy: { mean: number };
  completeness: { mean: number };
  cost: { total: number; mean: number };
  latency: { mean: number; p50: number; p95: number };
  cost_per_quality_point: number;
  overall_score: number;
  combined_score: number;
  test_count: number;
  total_tokens?: number;
  judge_cost_total?: number;
}

export interface ComprehensiveMetrics {
  overall: ModelMetrics;
  by_task?: Record<string, ModelMetrics>;
  by_topic?: Record<string, ModelMetrics>;
  by_format?: Record<string, ModelMetrics>;
  by_task_and_topic?: Record<string, Record<string, ModelMetrics>>;
  by_task_and_format?: Record<string, Record<string, ModelMetrics>>;
  by_topic_and_format?: Record<string, Record<string, ModelMetrics>>;
  summary_stats?: {
    total_tests: number;
    tasks_tested: string[];
    topics_tested: string[];
    formats_tested: string[];
    test_count_by_task: Record<string, number>;
    test_count_by_topic: Record<string, number>;
    test_count_by_format: Record<string, number>;
  };
}

export interface BenchmarkData {
  results: BenchmarkResult[];
  metrics: Record<string, ModelMetrics>;
  metricsComprehensive?: Record<string, ComprehensiveMetrics>;
  comparative: {
    rankings?: {
      by_overall_score?: string[];
      by_combined_score?: string[];
      by_reliability?: string[];
      by_content_quality?: string[];
      by_cost_effectiveness?: string[];
    };
  };
  hasResults: boolean;
}

export type TaskFilter = "all" | "summary" | "quiz" | "flashcards";
export type TopicFilter = "all" | string;
export type SortKey =
  | "score"
  | "reliability"
  | "content_quality"
  | "cost_per_quality"
  | "total_cost"
  | "latency"
  | "tests";
