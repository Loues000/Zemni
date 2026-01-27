"use client";

import { useEffect, useState } from "react";

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

export default function BenchmarksPage() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskFilter>("all");
  const [activeTopic, setActiveTopic] = useState<TopicFilter>("all");

  useEffect(() => {
    fetch("/api/benchmarks")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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

  const { metrics, metricsComprehensive, comparative } = data;
  const rankings = comparative.rankings || {};
  const overallRanking = rankings.by_overall_score || rankings.by_combined_score || [];

  // Get available topics from comprehensive metrics
  const availableTopics = new Set<string>();
  if (metricsComprehensive) {
    Object.values(metricsComprehensive).forEach((comp) => {
      if (comp.summary_stats?.topics_tested) {
        comp.summary_stats.topics_tested.forEach((t) => availableTopics.add(t));
      }
    });
  }
  const topicsList = Array.from(availableTopics).sort();

  // Get metrics for current filter
  const getFilteredMetrics = (modelId: string): ModelMetrics | null => {
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
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#27ae60";
    if (score >= 60) return "#f39c12";
    return "#e74c3c";
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: "#ffd700", text: "🥇" };
    if (rank === 2) return { bg: "#c0c0c0", text: "🥈" };
    if (rank === 3) return { bg: "#cd7f32", text: "🥉" };
    return { bg: "#ecf0f1", text: `#${rank}` };
  };

  const formatTopicName = (topic: string) => {
    return topic.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  return (
    <div className="benchmark-container">
      <h1>Model Benchmarks</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Comprehensive evaluation of LLM models on summary, quiz, and flashcard generation tasks.
      </p>

      {/* Task Tabs */}
      <div style={{ marginBottom: "2rem", borderBottom: "2px solid var(--stroke)" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {(["all", "summary", "quiz", "flashcards"] as TaskFilter[]).map((task) => (
            <button
              key={task}
              onClick={() => setActiveTask(task)}
              className={`benchmark-button ${activeTask === task ? "benchmark-button-active" : ""}`}
            >
              {task === "all" ? "All Tasks" : task}
            </button>
          ))}
        </div>

        {/* Topic Filter */}
        {topicsList.length > 0 && (
          <div className="benchmark-topic-filter">
            <span className="benchmark-topic-filter-label">Topic:</span>
            <button
              onClick={() => setActiveTopic("all")}
              className={`benchmark-topic-button ${activeTopic === "all" ? "benchmark-topic-button-active" : ""}`}
            >
              All Topics
            </button>
            {topicsList.map((topic) => (
              <button
                key={topic}
                onClick={() => setActiveTopic(topic)}
                className={`benchmark-topic-button ${activeTopic === topic ? "benchmark-topic-button-active" : ""}`}
              >
                {formatTopicName(topic)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Overall Rankings */}
      <section className="benchmark-section">
        <h2>
          {activeTask !== "all" ? `${activeTask.charAt(0).toUpperCase() + activeTask.slice(1)} ` : ""}
          {activeTopic !== "all" ? `${formatTopicName(activeTopic)} ` : ""}
          Rankings
        </h2>
        {activeTask !== "all" && metricsComprehensive && Object.keys(metricsComprehensive).length > 0 && (() => {
          // Prüfe ob Task-Daten vorhanden sind
          const hasTaskData = Object.values(metricsComprehensive).some(comp => {
            const taskMetrics = comp.by_task?.[activeTask];
            return taskMetrics && taskMetrics.test_count && taskMetrics.test_count > 0;
          });
          const isTested = Object.values(metricsComprehensive).some(comp => 
            comp.summary_stats?.tasks_tested?.includes(activeTask)
          );
          
          if (!hasTaskData && !isTested && activeTask !== "summary") {
            return (
              <div style={{ 
                padding: "2rem", 
                textAlign: "center", 
                color: "var(--text-secondary)",
                fontStyle: "italic",
                backgroundColor: "var(--background-secondary)",
                borderRadius: "8px"
              }}>
                <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
                  {activeTask.charAt(0).toUpperCase() + activeTask.slice(1)}-Daten werden später bereitgestellt
                </p>
                <p style={{ fontSize: "0.9rem" }}>
                  Bisher wurden nur Summary-Tests durchgeführt. Quiz- und Flashcard-Tests folgen in Kürze.
                </p>
              </div>
            );
          }
          return null;
        })()}
        {(() => {
          // Prüfe ob Daten für den aktiven Task vorhanden sind
          if (activeTask !== "all" && metricsComprehensive && Object.keys(metricsComprehensive).length > 0) {
            const hasTaskData = Object.values(metricsComprehensive).some(comp => {
              const taskMetrics = comp.by_task?.[activeTask];
              return taskMetrics && taskMetrics.test_count && taskMetrics.test_count > 0;
            });
            const isTested = Object.values(metricsComprehensive).some(comp => 
              comp.summary_stats?.tasks_tested?.includes(activeTask)
            );
            
            if (!hasTaskData && !isTested && activeTask !== "summary") {
              return null; // Keine Tabelle anzeigen wenn keine Daten
            }
          }
          return (
            <div style={{ overflowX: "auto" }}>
              <table className="benchmark-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Model</th>
                <th style={{ textAlign: "right" }}>Overall Score</th>
                <th style={{ textAlign: "right" }}>Reliability</th>
                <th style={{ textAlign: "right" }}>Content Quality</th>
                <th style={{ textAlign: "right" }}>Cost per Quality</th>
                <th style={{ textAlign: "right" }}>Total Cost</th>
                <th style={{ textAlign: "right" }}>Tests</th>
              </tr>
            </thead>
            <tbody>
              {overallRanking.slice(0, 20).map((modelId, idx) => {
                const model = getFilteredMetrics(modelId);
                if (!model) return null;
                const rank = idx + 1;
                const badge = getRankBadge(rank);
                const score = model.overall_score || model.combined_score || 0;
                const scoreClass = score >= 80 ? "benchmark-score-high" : score >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
                const badgeClass = rank === 1 ? "benchmark-rank-badge-gold" : rank === 2 ? "benchmark-rank-badge-silver" : rank === 3 ? "benchmark-rank-badge-bronze" : "benchmark-rank-badge-default";
                return (
                  <tr key={modelId}>
                    <td>
                      <span className={`benchmark-rank-badge ${badgeClass}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td style={{ fontWeight: "600" }}>{modelId}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={scoreClass}>
                        {score.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {model.reliability?.mean?.toFixed(2) || "N/A"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {model.content_quality?.mean?.toFixed(2) || "N/A"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      ${(model.cost_per_quality_point || 0).toFixed(4)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      ${(model.cost?.total || 0).toFixed(4)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {model.test_count || 0}
                    </td>
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
                      
                      if (!hasData && !isTested) {
                        // Task wurde noch nicht getestet - zeige "Coming soon" Nachricht
                        return (
                          <div key={task} className="benchmark-task-section" style={{ opacity: 0.6 }}>
                            <h4 className="benchmark-task-title">{task}</h4>
                            <div style={{ 
                              padding: "1rem", 
                              textAlign: "center", 
                              color: "var(--text-secondary)",
                              fontStyle: "italic"
                            }}>
                              Daten werden später bereitgestellt
                            </div>
                          </div>
                        );
                      }
                      
                      if (!taskMetrics) return null;
                      
                      const taskScore = taskMetrics.overall_score || taskMetrics.combined_score || 0;
                      const taskScoreClass = taskScore >= 80 ? "benchmark-score-high" : taskScore >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
                      return (
                        <div key={task} className="benchmark-task-section">
                          <h4 className="benchmark-task-title">{task}</h4>
                          <div className="benchmark-metric-row">
                            <span className="benchmark-metric-label">Score:</span>
                            <span className={`benchmark-metric-value ${taskScoreClass}`}>
                              {taskScore.toFixed(2)}
                            </span>
                          </div>
                          <div className="benchmark-metric-row">
                            <span className="benchmark-metric-label">Reliability:</span>
                            <span className="benchmark-metric-value">{taskMetrics.reliability?.mean?.toFixed(2) || "N/A"}</span>
                          </div>
                          <div className="benchmark-metric-row">
                            <span className="benchmark-metric-label">Quality:</span>
                            <span className="benchmark-metric-value">{taskMetrics.content_quality?.mean?.toFixed(2) || "N/A"}</span>
                          </div>
                          <div className="benchmark-metric-row">
                            <span className="benchmark-metric-label">Tests:</span>
                            <span className="benchmark-metric-value">{taskMetrics.test_count || 0}</span>
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
