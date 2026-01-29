"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface BenchmarkResult {
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
}

interface ModelMetrics {
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
}

interface ComprehensiveMetrics {
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

interface BenchmarkData {
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

type TaskFilter = "all" | "summary" | "quiz" | "flashcards";
type TopicFilter = "all" | string;
type SortKey =
  | "score"
  | "reliability"
  | "content_quality"
  | "cost_per_quality"
  | "total_cost"
  | "latency"
  | "tests";

export default function BenchmarksPage() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskFilter>("all");
  const [activeTopic, setActiveTopic] = useState<TopicFilter>("all");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [collapsedTaskSections, setCollapsedTaskSections] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [leaderboardLimit, setLeaderboardLimit] = useState<number>(20);
  const [modelQuery, setModelQuery] = useState<string>("");
  const [perTestFormat, setPerTestFormat] = useState<string>("all");
  const [selectedTestKey, setSelectedTestKey] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/benchmarks", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        const modelIds = Object.keys(data.metrics || {});
        if (modelIds.length > 0) {
          setSelectedModelId(modelIds[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Extract data properties safely
  const metrics = data?.metrics || {};
  const metricsComprehensive = data?.metricsComprehensive;
  const comparative = data?.comparative || {};
  const rankings = comparative.rankings || {};

  // Helper functions (must be defined before hooks that use them)
  const clamp0to100 = (n: number) => Math.max(0, Math.min(100, n));
  const scoreFor = (m: ModelMetrics | null) => (m?.overall_score || m?.combined_score || 0);
  const formatMoney = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(4)}`;
  const formatMs = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0)}ms`;

  const defaultSortDirForKey = (key: SortKey): "asc" | "desc" => {
    if (key === "cost_per_quality" || key === "total_cost" || key === "latency") return "asc";
    return "desc";
  };

  // Get metrics for current filter - must be useCallback to use in dependency arrays
  const getFilteredMetrics = useCallback((modelId: string): ModelMetrics | null => {
    if (!metricsComprehensive || !metricsComprehensive[modelId]) {
      return metrics[modelId] || null;
    }

    const comp = metricsComprehensive[modelId];

    // Task filter
    if (activeTask !== "all" && comp.by_task?.[activeTask]) {
      const taskMetrics = comp.by_task[activeTask];
      
      // Topic filter within task
      if (activeTopic !== "all" && comp.by_task_and_topic?.[activeTask]?.[activeTopic]) {
        return comp.by_task_and_topic[activeTask][activeTopic];
      }
      
      return taskMetrics;
    }

    // Topic filter (across all tasks)
    if (activeTopic !== "all" && comp.by_topic?.[activeTopic]) {
      return comp.by_topic[activeTopic];
    }

    // Default to overall
    return comp.overall;
  }, [activeTask, activeTopic, metrics, metricsComprehensive]);

  // All hooks must be called before any early returns
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
      if (activeTask !== "all" && r.task !== activeTask) return false;
      if (activeTopic !== "all" && r.test_case_topic !== activeTopic) return false;
      return true;
    });
  }, [activeTask, activeTopic, data?.results]);

  const filteredSummary = useMemo(() => {
    const models = new Set<string>();
    const formats = new Set<string>();
    filteredResults.forEach((r) => {
      models.add(r.model_id);
      if (r.test_case_format) formats.add(r.test_case_format);
    });

    const totalCost = filteredResults.reduce((sum, r) => sum + (typeof r.cost === "number" ? r.cost : 0), 0);
    const avgLatency =
      filteredResults.length > 0
        ? filteredResults.reduce((sum, r) => sum + (typeof r.latency_ms === "number" ? r.latency_ms : 0), 0) /
          filteredResults.length
        : 0;
    const avgReliability =
      filteredResults.length > 0
        ? filteredResults.reduce((sum, r) => sum + (typeof r.reliability_score === "number" ? r.reliability_score : 0), 0) /
          filteredResults.length
        : 0;
    const avgQuality =
      filteredResults.length > 0
        ? filteredResults.reduce((sum, r) => sum + (typeof r.content_quality_score === "number" ? r.content_quality_score : 0), 0) /
          filteredResults.length
        : 0;

    return {
      modelCount: models.size,
      testCount: filteredResults.length,
      formatCount: formats.size,
      totalCost,
      avgLatency,
      avgReliability,
      avgQuality,
    };
  }, [filteredResults]);

  const leaderboardRows = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();

    const rows = modelIds
      .map((modelId) => ({ modelId, model: getFilteredMetrics(modelId) }))
      .filter((row) => row.model && (row.model.test_count || 0) > 0)
      .filter((row) => (query ? row.modelId.toLowerCase().includes(query) : true));

    const valueFor = (m: ModelMetrics, key: SortKey): number => {
      if (key === "score") return scoreFor(m);
      if (key === "reliability") return m.reliability?.mean ?? -Infinity;
      if (key === "content_quality") return m.content_quality?.mean ?? -Infinity;
      if (key === "cost_per_quality") return m.cost_per_quality_point ?? Infinity;
      if (key === "total_cost") return m.cost?.total ?? Infinity;
      if (key === "latency") return m.latency?.mean ?? Infinity;
      return m.test_count ?? -Infinity;
    };

    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (!a.model && !b.model) return 0;
      if (!a.model) return 1;
      if (!b.model) return -1;
      const av = valueFor(a.model, sortKey);
      const bv = valueFor(b.model, sortKey);
      if (av === bv) return a.modelId.localeCompare(b.modelId);
      return (av - bv) * dir;
    });

    return rows;
  }, [getFilteredMetrics, modelIds, modelQuery, sortDir, sortKey]);

  const limitedLeaderboardRows = useMemo(() => {
    if (leaderboardLimit <= 0) return leaderboardRows;
    return leaderboardRows.slice(0, leaderboardLimit);
  }, [leaderboardLimit, leaderboardRows]);

  const availableFormatsForSelectedModel = useMemo(() => {
    if (!selectedModelId) return [];
    const formats = new Set<string>();
    filteredResults.forEach((r) => {
      if (r.model_id !== selectedModelId) return;
      if (r.test_case_format) formats.add(r.test_case_format);
    });
    return Array.from(formats).sort();
  }, [filteredResults, selectedModelId]);

  const selectedTest = useMemo(() => {
    if (!selectedTestKey) return null;
    return (
      filteredResults.find((r) => `${r.model_id}::${r.task}::${r.test_case_id}` === selectedTestKey) ||
      data?.results?.find((r) => `${r.model_id}::${r.task}::${r.test_case_id}` === selectedTestKey) ||
      null
    );
  }, [data?.results, filteredResults, selectedTestKey]);

  const selectedModelMetrics = getFilteredMetrics(selectedModelId);

  // Early returns after all hooks
  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading benchmark data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "red" }}>
        <p>Error loading benchmark data: {error}</p>
      </div>
    );
  }

  if (!data || !data.hasResults) {
    return (
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <h1>Model Benchmarks</h1>
        <p>No benchmark results found. Run the benchmark first:</p>
        <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "4px", overflow: "auto" }}>
          {`cd benchmark
python run_benchmark.py --models "gpt-4o,claude-sonnet" --tasks summary,quiz`}
        </pre>
      </div>
    );
  }

  // Helper functions that don't depend on hooks
  const formatTopicName = (topic: string) => {
    return topic.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const toggleTaskSection = (modelId: string, task: string) => {
    const key = `${modelId}::${task}`;
    setCollapsedTaskSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="benchmark-container">
      <div className="benchmark-header">
        <h1>Model Benchmarks</h1>
        <p className="benchmark-subtitle">Compare model performance across tasks. Scores use a 1-100 scale.</p>
      </div>

      <div className="benchmark-controls" role="region" aria-label="Benchmark filters">
        <div className="benchmark-controls-row">
          <div className="benchmark-segment" role="tablist" aria-label="Task filter">
            {(["all", "summary", "quiz", "flashcards"] as TaskFilter[]).map((task) => (
              <button
                key={task}
                type="button"
                onClick={() => setActiveTask(task)}
                aria-pressed={activeTask === task}
                className={`benchmark-button ${activeTask === task ? "benchmark-button-active" : ""}`}
              >
                {task === "all" ? "All" : task}
              </button>
            ))}
          </div>

          <label className="benchmark-control">
            <span className="benchmark-control-label">Topic</span>
            <select value={activeTopic} onChange={(e) => setActiveTopic(e.target.value)} className="benchmark-control-input">
              <option value="all">All topics</option>
              {topicsList.map((topic) => (
                <option key={topic} value={topic}>
                  {formatTopicName(topic)}
                </option>
              ))}
            </select>
          </label>

          <label className="benchmark-control">
            <span className="benchmark-control-label">Sort</span>
            <select
              value={sortKey}
              onChange={(e) => {
                const nextKey = e.target.value as SortKey;
                setSortKey(nextKey);
                setSortDir(defaultSortDirForKey(nextKey));
              }}
              className="benchmark-control-input"
            >
              <option value="score">Score</option>
              <option value="reliability">Reliability</option>
              <option value="content_quality">Content quality</option>
              <option value="cost_per_quality">Cost / quality</option>
              <option value="total_cost">Total cost</option>
              <option value="latency">Latency</option>
              <option value="tests">Tests</option>
            </select>
          </label>

          <label className="benchmark-control">
            <span className="benchmark-control-label">Show</span>
            <select
              value={leaderboardLimit}
              onChange={(e) => setLeaderboardLimit(Number(e.target.value))}
              className="benchmark-control-input"
            >
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={0}>All</option>
            </select>
          </label>

          <label className="benchmark-control benchmark-control-grow">
            <span className="benchmark-control-label">Search</span>
            <input
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              placeholder="Filter by model id..."
              className="benchmark-control-input"
            />
          </label>

          <button
            type="button"
            className="benchmark-control-button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={`Toggle sort direction (currently ${sortDir})`}
            title={`Sort: ${sortDir === "asc" ? "ascending" : "descending"}`}
          >
            {sortDir === "asc" ? "Asc" : "Desc"}
          </button>
        </div>

        <div className="benchmark-kpi-grid" aria-label="Summary stats">
          <div className="benchmark-kpi">
            <div className="benchmark-kpi-label">Models</div>
            <div className="benchmark-kpi-value">{filteredSummary.modelCount}</div>
          </div>
          <div className="benchmark-kpi">
            <div className="benchmark-kpi-label">Tests</div>
            <div className="benchmark-kpi-value">{filteredSummary.testCount}</div>
          </div>
          <div className="benchmark-kpi">
            <div className="benchmark-kpi-label">Formats</div>
            <div className="benchmark-kpi-value">{filteredSummary.formatCount}</div>
          </div>
          <div className="benchmark-kpi">
            <div className="benchmark-kpi-label">Avg reliability</div>
            <div className="benchmark-kpi-value">{filteredSummary.avgReliability.toFixed(1)}</div>
          </div>
          <div className="benchmark-kpi">
            <div className="benchmark-kpi-label">Avg quality</div>
            <div className="benchmark-kpi-value">{filteredSummary.avgQuality.toFixed(1)}</div>
          </div>
          <div className="benchmark-kpi">
            <div className="benchmark-kpi-label">Total cost</div>
            <div className="benchmark-kpi-value">{formatMoney(filteredSummary.totalCost)}</div>
          </div>
          <div className="benchmark-kpi">
            <div className="benchmark-kpi-label">Avg latency</div>
            <div className="benchmark-kpi-value">{formatMs(filteredSummary.avgLatency)}</div>
          </div>
        </div>
      </div>

      {/* Overall Rankings */}
      <section className="benchmark-section">
        <div className="benchmark-section-header">
          <h2>Leaderboard</h2>
          <div className="benchmark-stats-text">
            Showing {limitedLeaderboardRows.length} of {leaderboardRows.length} models
            {activeTask !== "all" ? ` | Task: ${activeTask}` : ""}
            {activeTopic !== "all" ? ` | Topic: ${formatTopicName(activeTopic)}` : ""}
          </div>
        </div>
        {activeTask !== "all" && metricsComprehensive && Object.keys(metricsComprehensive).length > 0 && (() => {
          // Check if task data is present
          const hasTaskData = Object.values(metricsComprehensive).some(comp => {
            const taskMetrics = comp.by_task?.[activeTask];
            return taskMetrics && taskMetrics.test_count && taskMetrics.test_count > 0;
          });
          const isTested = Object.values(metricsComprehensive).some(comp => 
            comp.summary_stats?.tasks_tested?.includes(activeTask)
          );
          
          if (!hasTaskData && !isTested && activeTask !== "summary") {
            return (
              <div className="benchmark-empty-state" role="status">
                <div className="benchmark-empty-title">
                  {activeTask.charAt(0).toUpperCase() + activeTask.slice(1)} data will be available later
                </div>
                <div className="benchmark-empty-subtitle">
                  So far only summary tests have been executed. Quiz and flashcard benchmarks will follow.
                </div>
              </div>
            );
          }
          return null;
        })()}
        {(() => {
          // Hide the leaderboard table if the selected task has no data yet.
          if (activeTask !== "all" && metricsComprehensive && Object.keys(metricsComprehensive).length > 0) {
            const hasTaskData = Object.values(metricsComprehensive).some(comp => {
              const taskMetrics = comp.by_task?.[activeTask];
              return taskMetrics && taskMetrics.test_count && taskMetrics.test_count > 0;
            });
            const isTested = Object.values(metricsComprehensive).some(comp => 
              comp.summary_stats?.tasks_tested?.includes(activeTask)
            );
            
            if (!hasTaskData && !isTested && activeTask !== "summary") {
              return null;
            }
          }
          return (
        <div style={{ overflowX: "auto" }}>
              <table className="benchmark-table" aria-label="Model leaderboard">
            <thead>
              <tr>
                <th style={{ width: "72px" }}>Rank</th>
                <th>Model</th>
                <th className="benchmark-th-right">Score</th>
                <th className="benchmark-th-right">Reliability</th>
                <th className="benchmark-th-right">Quality</th>
                <th className="benchmark-th-right">Cost / quality</th>
                <th className="benchmark-th-right">Total cost</th>
                <th className="benchmark-th-right">Latency</th>
                <th className="benchmark-th-right">Tests</th>
              </tr>
            </thead>
            <tbody>
              {limitedLeaderboardRows.map(({ modelId, model }, idx) => {
                if (!model) return null;
                const rank = idx + 1;
                const badgeClass =
                  rank === 1
                    ? "benchmark-rank-badge-gold"
                    : rank === 2
                      ? "benchmark-rank-badge-silver"
                      : rank === 3
                        ? "benchmark-rank-badge-bronze"
                        : "benchmark-rank-badge-default";

                const score = scoreFor(model);
                const scoreClass =
                  score >= 80 ? "benchmark-score-high" : score >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
                const isSelected = selectedModelId === modelId;

                return (
                  <tr
                    key={modelId}
                    className={isSelected ? "benchmark-row-selected" : undefined}
                    onClick={() => {
                      setSelectedModelId(modelId);
                      setSelectedTestKey("");
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedModelId(modelId);
                        setSelectedTestKey("");
                      }
                    }}
                    aria-label={`Select ${modelId}`}
                  >
                    <td>
                      <span className={`benchmark-rank-badge ${badgeClass}`}>{rank}</span>
                    </td>
                    <td style={{ fontWeight: "600" }}>
                      <span className="benchmark-model-id">{modelId}</span>
                    </td>
                    <td className="benchmark-td-right">
                      <div className="benchmark-scorecell">
                        <span className={scoreClass}>{score.toFixed(1)}</span>
                        <div className="benchmark-bar" aria-hidden="true">
                          <div className="benchmark-bar-fill" style={{ width: `${clamp0to100(score)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="benchmark-td-right">
                      {model.reliability?.mean != null ? (
                        <span title={model.reliability?.std_dev != null ? `std dev: ${model.reliability.std_dev.toFixed(2)}` : undefined}>
                          {model.reliability.mean.toFixed(1)}
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="benchmark-td-right">
                      {model.content_quality?.mean != null ? (
                        <span
                          title={
                            model.content_quality?.std_dev != null ? `std dev: ${model.content_quality.std_dev.toFixed(2)}` : undefined
                          }
                        >
                          {model.content_quality.mean.toFixed(1)}
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="benchmark-td-right">
                      {model.cost_per_quality_point != null ? formatMoney(model.cost_per_quality_point) : "N/A"}
                    </td>
                    <td className="benchmark-td-right">{model.cost?.total != null ? formatMoney(model.cost.total) : "N/A"}</td>
                    <td className="benchmark-td-right">{model.latency?.mean != null ? formatMs(model.latency.mean) : "N/A"}</td>
                    <td className="benchmark-td-right">{model.test_count ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          );
        })()}
      </section>

      {/* Task-Specific Breakdown */}
      {metricsComprehensive && Object.keys(metricsComprehensive).length > 0 && (
        <section className="benchmark-section">
          <h2>Task-Specific Performance</h2>
          <div className="benchmark-grid benchmark-grid-400">
            {Object.entries(metricsComprehensive).map(([modelId, comp]) => {
              if (!comp.by_task || Object.keys(comp.by_task).length === 0) return null;
              return (
                <div key={modelId} className="benchmark-card">
                  <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>{modelId}</h3>
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {(["summary", "quiz", "flashcards"] as const).map((task) => {
                      const taskMetrics = comp.by_task?.[task];
                      const hasData = taskMetrics && taskMetrics.test_count && taskMetrics.test_count > 0;
                      const isTested = comp.summary_stats?.tasks_tested?.includes(task);
                      const key = `${modelId}::${task}`;
                      const isCollapsible = task === "quiz" || task === "flashcards";
                      const isCollapsed = isCollapsible && collapsedTaskSections[key];
                      
                      if (!hasData && !isTested) {
                        // Task has not been tested yet.
                        return (
                          <div key={task} className="benchmark-task-section" style={{ opacity: 0.6 }}>
                            <h4 className="benchmark-task-title">
                              {task}
                              {isCollapsible && (
                                <button
                                  type="button"
                                  style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}
                                  onClick={() => toggleTaskSection(modelId, task)}
                                >
                                  {isCollapsed ? "Expand" : "Collapse"}
                                </button>
                              )}
                            </h4>
                            <div style={{ 
                              padding: "1rem", 
                              textAlign: "center", 
                              color: "var(--text-secondary)",
                              fontStyle: "italic"
                            }}>
                              Data will be added later
                            </div>
                          </div>
                        );
                      }
                      
                      if (!taskMetrics) return null;
                      
                      const taskScore = taskMetrics.overall_score || taskMetrics.combined_score || 0;
                      const taskScoreClass = taskScore >= 80 ? "benchmark-score-high" : taskScore >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
                      return (
                        <div key={task} className="benchmark-task-section">
                          <h4 className="benchmark-task-title">
                            {task}
                            {isCollapsible && (
                              <button
                                type="button"
                                style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}
                                onClick={() => toggleTaskSection(modelId, task)}
                              >
                                {isCollapsed ? "Expand" : "Collapse"}
                              </button>
                            )}
                          </h4>
                          {!isCollapsed && (
                            <>
                              <div className="benchmark-metric-row">
                                <span className="benchmark-metric-label">Score:</span>
                                <span className={`benchmark-metric-value ${taskScoreClass}`}>
                                  {taskScore.toFixed(2)}
                                </span>
                              </div>
                              <div className="benchmark-metric-row">
                                <span className="benchmark-metric-label">Reliability:</span>
                                <span className="benchmark-metric-value">
                                  {taskMetrics.reliability?.mean?.toFixed(2) || "N/A"}
                                </span>
                              </div>
                              <div className="benchmark-metric-row">
                                <span className="benchmark-metric-label">Quality:</span>
                                <span className="benchmark-metric-value">
                                  {taskMetrics.content_quality?.mean?.toFixed(2) || "N/A"}
                                </span>
                              </div>
                              <div className="benchmark-metric-row">
                                <span className="benchmark-metric-label">Tests:</span>
                                <span className="benchmark-metric-value">
                                  {taskMetrics.test_count || 0}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Topic-Specific Breakdown */}
      {metricsComprehensive && Object.keys(metricsComprehensive).length > 0 && (
        <section className="benchmark-section">
          <h2>Topic-Specific Performance</h2>
          <div className="benchmark-grid benchmark-grid-auto">
            {topicsList.map((topic) => {
              const topicMetrics: Array<{ modelId: string; metrics: ModelMetrics }> = [];
              Object.entries(metricsComprehensive).forEach(([modelId, comp]) => {
                if (comp.by_topic?.[topic]) {
                  topicMetrics.push({ modelId, metrics: comp.by_topic[topic] });
                }
              });
              
              if (topicMetrics.length === 0) return null;

              // Sort by overall score
              topicMetrics.sort((a, b) => 
                (b.metrics.overall_score || b.metrics.combined_score || 0) - 
                (a.metrics.overall_score || a.metrics.combined_score || 0)
              );

              return (
                <div key={topic} className="benchmark-card">
                  <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>{formatTopicName(topic)}</h3>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {topicMetrics.slice(0, 5).map(({ modelId, metrics }, idx) => {
                      const topicScore = metrics.overall_score || metrics.combined_score || 0;
                      const topicScoreClass = topicScore >= 80 ? "benchmark-score-high" : topicScore >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
                      return (
                        <div key={modelId} className="benchmark-topic-card">
                          <div className="benchmark-topic-header">
                          <span style={{ fontWeight: "600" }}>#{idx + 1} {modelId}</span>
                            <span className={`benchmark-metric-value ${topicScoreClass}`}>
                              {topicScore.toFixed(1)}
                          </span>
                        </div>
                          <div className="benchmark-topic-stats">
                          Rel: {metrics.reliability?.mean?.toFixed(1)} | 
                          Qual: {metrics.content_quality?.mean?.toFixed(1)} | 
                          Tests: {metrics.test_count}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Per-test breakdown for selected model */}
      <section className="benchmark-section">
        <h2>Model Explorer</h2>
        <div className="benchmark-explorer-controls">
          <label className="benchmark-control benchmark-control-inline">
            <span className="benchmark-control-label">Model</span>
            <select
              value={selectedModelId}
              onChange={(e) => {
                setSelectedModelId(e.target.value);
                setSelectedTestKey("");
                setPerTestFormat("all");
              }}
              className="benchmark-control-input"
            >
              {modelIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="benchmark-control benchmark-control-inline">
            <span className="benchmark-control-label">Format</span>
            <select value={perTestFormat} onChange={(e) => setPerTestFormat(e.target.value)} className="benchmark-control-input">
              <option value="all">All</option>
              {availableFormatsForSelectedModel.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <div className="benchmark-stats-text benchmark-explorer-context">
            {activeTask !== "all" ? `Task: ${activeTask}` : "All tasks"}
            {activeTopic !== "all" ? ` | Topic: ${formatTopicName(activeTopic)}` : ""}
          </div>
        </div>

        {selectedModelMetrics && (
          <div className="benchmark-model-summary" aria-label="Selected model summary">
            <div className="benchmark-metric-row">
              <span className="benchmark-metric-label">Score</span>
              <span className="benchmark-metric-value">{scoreFor(selectedModelMetrics).toFixed(1)}</span>
            </div>
            <div className="benchmark-metric-row">
              <span className="benchmark-metric-label">Reliability</span>
              <span className="benchmark-metric-value">{selectedModelMetrics.reliability?.mean?.toFixed(1) ?? "N/A"}</span>
            </div>
            <div className="benchmark-metric-row">
              <span className="benchmark-metric-label">Quality</span>
              <span className="benchmark-metric-value">{selectedModelMetrics.content_quality?.mean?.toFixed(1) ?? "N/A"}</span>
            </div>
            <div className="benchmark-metric-row">
              <span className="benchmark-metric-label">Cost / quality</span>
              <span className="benchmark-metric-value">
                {selectedModelMetrics.cost_per_quality_point != null ? formatMoney(selectedModelMetrics.cost_per_quality_point) : "N/A"}
              </span>
            </div>
            <div className="benchmark-metric-row">
              <span className="benchmark-metric-label">Total cost</span>
              <span className="benchmark-metric-value">
                {selectedModelMetrics.cost?.total != null ? formatMoney(selectedModelMetrics.cost.total) : "N/A"}
              </span>
            </div>
            <div className="benchmark-metric-row">
              <span className="benchmark-metric-label">Latency</span>
              <span className="benchmark-metric-value">{selectedModelMetrics.latency?.mean != null ? formatMs(selectedModelMetrics.latency.mean) : "N/A"}</span>
            </div>
          </div>
        )}
        {selectedModelId && (<>
          <div style={{ overflowX: "auto" }}>
            <table className="benchmark-table benchmark-table-compact" aria-label="Per-test results">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Task</th>
                  <th>Topic</th>
                  <th>Format</th>
                  <th className="benchmark-th-right">Rel</th>
                  <th className="benchmark-th-right">Qual</th>
                  <th className="benchmark-th-right">Cost</th>
                  <th className="benchmark-th-right">Latency</th>
                </tr>
              </thead>
              <tbody>
                {data.results
                  .filter((r) => r.model_id === selectedModelId)
                  .filter((r) => (activeTask === "all" ? true : r.task === activeTask))
                  .filter((r) => (activeTopic === "all" ? true : r.test_case_topic === activeTopic))
                  .filter((r) => (perTestFormat === "all" ? true : r.test_case_format === perTestFormat))
                  .sort((a, b) => a.test_case_id.localeCompare(b.test_case_id))
                  .map((r) => {
                    const key = `${r.model_id}::${r.task}::${r.test_case_id}`;
                    const isSelected = key === selectedTestKey;
                    return (
                      <tr
                        key={key}
                        className={isSelected ? "benchmark-row-selected" : undefined}
                        onClick={() => setSelectedTestKey(key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedTestKey(key);
                        }}
                        aria-label={`Select test ${r.test_case_id}`}
                      >
                        <td>{r.test_case_id}</td>
                        <td>{r.task}</td>
                        <td>{r.test_case_topic || "N/A"}</td>
                        <td>{r.test_case_format || "N/A"}</td>
                        <td className="benchmark-td-right">
                          {typeof r.reliability_score === "number" ? r.reliability_score.toFixed(1) : "N/A"}
                        </td>
                        <td className="benchmark-td-right">
                          {typeof r.content_quality_score === "number" ? r.content_quality_score.toFixed(1) : "N/A"}
                        </td>
                        <td className="benchmark-td-right">{typeof r.cost === "number" ? formatMoney(r.cost) : "N/A"}</td>
                        <td className="benchmark-td-right">
                          {typeof r.latency_ms === "number" ? formatMs(r.latency_ms) : "N/A"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="benchmark-output">
            <div className="benchmark-output-header">
              <div>
                <div className="benchmark-output-title">Output</div>
                <div className="benchmark-output-subtitle">
                  {selectedTest ? `${selectedTest.task} - ${selectedTest.test_case_id}` : "Select a row to preview the full output"}
                </div>
              </div>
              <button
                type="button"
                className="benchmark-control-button"
                disabled={!selectedTest?.output_text}
                onClick={() => {
                  const text = selectedTest?.output_text || "";
                  if (!text) return;
                  navigator.clipboard?.writeText(text);
                }}
              >
                Copy
              </button>
            </div>
            <pre className="benchmark-output-pre">{selectedTest?.output_text || "N/A"}</pre>
          </div>
        </>)}
      </section>

      {/* Detailed Model Metrics */}
      <section className="benchmark-section">
        <h2>Detailed Metrics</h2>
        <div className="benchmark-grid benchmark-grid-auto">
          {Object.entries(metrics).map(([modelId, model]) => {
            const comp = metricsComprehensive?.[modelId];
            const modelScore = model.overall_score || model.combined_score || 0;
            const modelScoreClass = modelScore >= 80 ? "benchmark-score-high" : modelScore >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
            return (
              <div key={modelId} className="benchmark-card">
                <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>{modelId}</h3>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div className="benchmark-metric-row">
                    <span className="benchmark-metric-label">Overall Score:</span>
                    <span className={`benchmark-metric-value ${modelScoreClass}`}>
                      {modelScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="benchmark-metric-row">
                    <span className="benchmark-metric-label">Reliability:</span>
                    <span className="benchmark-metric-value">{model.reliability?.mean?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="benchmark-metric-row">
                    <span className="benchmark-metric-label">Content Quality:</span>
                    <span className="benchmark-metric-value">{model.content_quality?.mean?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="benchmark-metric-row">
                    <span className="benchmark-metric-label">Factual Accuracy:</span>
                    <span className="benchmark-metric-value">{model.factual_accuracy?.mean?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="benchmark-metric-row">
                    <span className="benchmark-metric-label">Completeness:</span>
                    <span className="benchmark-metric-value">{model.completeness?.mean?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="benchmark-metric-row">
                    <span className="benchmark-metric-label">Total Cost:</span>
                    <span className="benchmark-metric-value">${(model.cost?.total || 0).toFixed(4)}</span>
                  </div>
                  <div className="benchmark-metric-row">
                    <span className="benchmark-metric-label">Avg Latency:</span>
                    <span className="benchmark-metric-value">{Math.round(model.latency?.mean || 0)}ms</span>
                  </div>
                  <div className="benchmark-metric-row">
                    <span className="benchmark-metric-label">Test Count:</span>
                    <span className="benchmark-metric-value">{model.test_count || 0}</span>
                  </div>
                  {comp?.summary_stats && (
                    <div className="benchmark-divider">
                      <div className="benchmark-stats-text">Tasks: {comp.summary_stats.tasks_tested.join(", ")}</div>
                      <div className="benchmark-stats-text">Topics: {comp.summary_stats.topics_tested.length}</div>
                      </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rankings by Category */}
      <section className="benchmark-section">
        <h2>Rankings by Category</h2>
        <div className="benchmark-grid benchmark-grid-auto">
          {rankings.by_reliability && (
            <div className="benchmark-card">
              <h3 style={{ marginTop: 0 }}>By Reliability</h3>
              <ol style={{ paddingLeft: "1.5rem" }}>
                {rankings.by_reliability.slice(0, 5).map((modelId, idx) => (
                  <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                    {modelId} ({metrics[modelId]?.reliability?.mean?.toFixed(2) || "N/A"})
                  </li>
                ))}
              </ol>
            </div>
          )}
          {rankings.by_content_quality && (
            <div className="benchmark-card">
              <h3 style={{ marginTop: 0 }}>By Content Quality</h3>
              <ol style={{ paddingLeft: "1.5rem" }}>
                {rankings.by_content_quality.slice(0, 5).map((modelId, idx) => (
                  <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                    {modelId} ({metrics[modelId]?.content_quality?.mean?.toFixed(2) || "N/A"})
                  </li>
                ))}
              </ol>
            </div>
          )}
          {rankings.by_cost_effectiveness && (
            <div className="benchmark-card">
              <h3 style={{ marginTop: 0 }}>By Cost Effectiveness</h3>
              <ol style={{ paddingLeft: "1.5rem" }}>
                {rankings.by_cost_effectiveness.slice(0, 5).map((modelId, idx) => (
                  <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                    {modelId} (${metrics[modelId]?.cost_per_quality_point?.toFixed(4) || "N/A"})
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
