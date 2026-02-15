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
  input_length_chars?: number;
  input_length_original_chars?: number;
  input_standardization_mode?: string;
  length_penalty_factor?: number;
  judge_quality_excluded?: boolean;
  judge_quality_exclusion_reason?: string;
}

export interface MetricWithCI {
  mean: number;
  std_dev: number;
  ci_95_lower?: number;
  ci_95_upper?: number;
  stderr?: number;
  margin_of_error?: number;
}

export interface ModelMetrics {
  reliability: MetricWithCI;
  content_quality: MetricWithCI;
  factual_accuracy: MetricWithCI;
  completeness: MetricWithCI;
  cost: { total: number; mean: number };
  latency: { mean: number; p50: number; p95: number };
  input_length?: {
    mean: number;
    median?: number;
    min: number;
    max: number;
    below_1000_warning?: boolean;
  };
  cost_per_quality_point: number;
  overall_score: number;
  combined_score: number;
  test_count: number;
  quality_sample_count?: number;
  quality_excluded_count?: number;
  total_tokens?: number;
  judge_cost_total?: number;
}

export interface RankingDetail {
  rank: number;
  model_id: string;
  score: number;
  ci_95_lower?: number;
  ci_95_upper?: number;
  margin_of_error?: number;
  is_statistical_tie?: boolean;
  tie_with_previous?: boolean;
  tie_with_next?: boolean;
  significance_marker?: string;
  significance_note?: string;
}

export interface ModelRankingStatus {
  task_counts?: Record<string, number>;
  eligible_for_overall?: boolean;
  is_partial?: boolean;
  missing_requirements?: string[];
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
      by_task?: Record<string, string[]>;
    };
    ranking_details?: {
      by_content_quality?: RankingDetail[];
      by_reliability?: RankingDetail[];
    };
    model_status?: Record<string, ModelRankingStatus>;
    coverage_thresholds?: Record<string, number>;
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
