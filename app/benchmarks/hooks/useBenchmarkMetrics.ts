import { useCallback, useMemo } from "react";
import type {
  BenchmarkData,
  BenchmarkResult,
  ComprehensiveMetrics,
  ModelMetrics,
  SortKey,
  TaskFilter,
  TopicFilter,
} from "../types";
import { costPer100QualityPoints, getDisplayName, scoreFor } from "../utils";

interface UseBenchmarkMetricsProps {
  data: BenchmarkData | null;
  filters: { task: TaskFilter; topic: TopicFilter; format: string };
  view: { sortKey: SortKey; sortDir: "asc" | "desc"; leaderboardLimit: number; modelQuery: string };
  selection: { modelId: string; testKey: string };
  modelDisplayNames: Record<string, string>;
}

export function useBenchmarkMetrics({
  data,
  filters,
  view,
  selection,
  modelDisplayNames,
}: UseBenchmarkMetricsProps) {
  const metrics = data?.metrics || {};
  const metricsComprehensive = data?.metricsComprehensive;
  const comparative = data?.comparative || {};
  const rankings = comparative.rankings || {};

  // Get metrics for current filter
  const getFilteredMetrics = useCallback(
    (modelId: string): ModelMetrics | null => {
      if (!metricsComprehensive || !metricsComprehensive[modelId]) {
        return metrics[modelId] || null;
      }

      const comp = metricsComprehensive[modelId];

      // Task filter
      if (filters.task !== "all" && comp.by_task?.[filters.task]) {
        const taskMetrics = comp.by_task[filters.task];

        // Topic filter within task
        if (filters.topic !== "all" && comp.by_task_and_topic?.[filters.task]?.[filters.topic]) {
          return comp.by_task_and_topic[filters.task][filters.topic];
        }

        return taskMetrics;
      }

      // Topic filter (across all tasks)
      if (filters.topic !== "all" && comp.by_topic?.[filters.topic]) {
        return comp.by_topic[filters.topic];
      }

      // Default to overall
      return comp.overall;
    },
    [filters.task, filters.topic, metrics, metricsComprehensive]
  );

  const modelIds = useMemo(() => Object.keys(metrics), [metrics]);

  const topicsList = useMemo(() => {
    if (!data?.results) return [];
    const availableTopics = new Set<string>();

    data.results.forEach((r) => {
      if (r.test_case_topic) availableTopics.add(r.test_case_topic);
    });

    if (metricsComprehensive) {
      Object.values(metricsComprehensive).forEach((comp) => {
        comp.summary_stats?.topics_tested?.forEach((t) => availableTopics.add(t));
      });
    }

    return Array.from(availableTopics).sort();
  }, [data?.results, metricsComprehensive]);

  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    return data.results.filter((r) => {
      if (filters.task !== "all" && r.task !== filters.task) return false;
      if (filters.topic !== "all" && r.test_case_topic !== filters.topic) return false;
      return true;
    });
  }, [filters.task, filters.topic, data?.results]);

  const leaderboardRows = useMemo(() => {
    const query = view.modelQuery.trim().toLowerCase();

    const rows = modelIds
      .map((modelId) => ({ modelId, model: getFilteredMetrics(modelId) }))
      .filter((row) => row.model && (row.model.test_count || 0) > 0)
      .filter((row) => {
        if (!query) return true;
        const displayName = getDisplayName(row.modelId, modelDisplayNames).toLowerCase();
        return displayName.includes(query) || row.modelId.toLowerCase().includes(query);
      });

    const valueFor = (m: ModelMetrics, key: SortKey): number => {
      if (key === "score") return scoreFor(m);
      if (key === "reliability") return m.reliability?.mean ?? -Infinity;
      if (key === "content_quality") return m.content_quality?.mean ?? -Infinity;
      if (key === "cost_per_quality") return costPer100QualityPoints(m);
      if (key === "total_cost") return m.cost?.total ?? Infinity;
      if (key === "latency") return m.latency?.mean ?? Infinity;
      return m.test_count ?? -Infinity;
    };

    const dir = view.sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (!a.model && !b.model) return 0;
      if (!a.model) return 1;
      if (!b.model) return -1;
      const av = valueFor(a.model, view.sortKey);
      const bv = valueFor(b.model, view.sortKey);
      if (av === bv) return a.modelId.localeCompare(b.modelId);
      return (av - bv) * dir;
    });

    return rows;
  }, [getFilteredMetrics, modelIds, view.modelQuery, view.sortDir, view.sortKey, modelDisplayNames]);

  const limitedLeaderboardRows = useMemo(() => {
    if (view.leaderboardLimit <= 0) return leaderboardRows;
    return leaderboardRows.slice(0, view.leaderboardLimit);
  }, [view.leaderboardLimit, leaderboardRows]);

  const availableFormatsForSelectedModel = useMemo(() => {
    if (!selection.modelId) return [];
    const formats = new Set<string>();
    filteredResults.forEach((r) => {
      if (r.model_id !== selection.modelId) return;
      if (r.test_case_format) formats.add(r.test_case_format);
    });
    return Array.from(formats).sort();
  }, [filteredResults, selection.modelId]);

  const selectedTest = useMemo(() => {
    if (!selection.testKey) return null;
    return (
      filteredResults.find((r) => `${r.model_id}::${r.task}::${r.test_case_id}` === selection.testKey) ||
      data?.results?.find((r) => `${r.model_id}::${r.task}::${r.test_case_id}` === selection.testKey) ||
      null
    );
  }, [data?.results, filteredResults, selection.testKey]);

  const selectedModelMetrics = useMemo(() => {
    const base = getFilteredMetrics(selection.modelId);
    if (!base || !data?.results) return base;

    // Calculate token totals and judge costs from results
    const modelResults = data.results.filter((r) => r.model_id === selection.modelId);
    const totalTokens = modelResults.reduce((sum, r) => {
      return sum + (r.usage?.total_tokens || 0);
    }, 0);
    const totalJudgeCost = modelResults.reduce((sum, r) => {
      return sum + (r.judge_cost || r.total_judge_cost || 0);
    }, 0);

    return {
      ...base,
      total_tokens: totalTokens > 0 ? totalTokens : undefined,
      judge_cost_total: totalJudgeCost > 0 ? totalJudgeCost : undefined,
    };
  }, [getFilteredMetrics, selection.modelId, data?.results]);

  return {
    metrics,
    metricsComprehensive,
    rankings,
    modelIds,
    topicsList,
    filteredResults,
    leaderboardRows,
    limitedLeaderboardRows,
    availableFormatsForSelectedModel,
    selectedTest,
    selectedModelMetrics,
    getFilteredMetrics,
  };
}
