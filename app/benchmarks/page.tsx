"use client";

import { useEffect, useState } from "react";

interface BenchmarkResult {
  model_id: string;
  task: string;
  test_case_id: string;
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

interface BenchmarkData {
  results: BenchmarkResult[];
  metrics: Record<string, ModelMetrics>;
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

export default function BenchmarksPage() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const { metrics, comparative } = data;
  const rankings = comparative.rankings || {};
  const overallRanking = rankings.by_overall_score || rankings.by_combined_score || [];

  const getScoreColor = (score: number) => {
    // Score is now 1-100 instead of 0-10
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

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <h1>Model Benchmarks</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Comprehensive evaluation of LLM models on summary, quiz, and flashcard generation tasks.
      </p>

      {/* Overall Rankings */}
      <section style={{ marginBottom: "3rem" }}>
        <h2>Overall Rankings</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "8px", overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#3498db", color: "white" }}>
                <th style={{ padding: "12px", textAlign: "left" }}>Rank</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Model</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Overall Score</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Reliability</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Content Quality</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Cost per Quality</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Total Cost</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Tests</th>
              </tr>
            </thead>
            <tbody>
              {overallRanking.slice(0, 20).map((modelId, idx) => {
                const model = metrics[modelId];
                if (!model) return null;
                const rank = idx + 1;
                const badge = getRankBadge(rank);
                return (
                  <tr key={modelId} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: badge.bg,
                          fontWeight: "bold"
                        }}
                      >
                        {badge.text}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontWeight: "600" }}>{modelId}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <span style={{ color: getScoreColor(model.overall_score || model.combined_score), fontWeight: "bold" }}>
                        {(model.overall_score || model.combined_score || 0).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {model.reliability?.mean?.toFixed(2) || "N/A"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {model.content_quality?.mean?.toFixed(2) || "N/A"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      ${(model.cost_per_quality_point || 0).toFixed(4)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      ${(model.cost?.total || 0).toFixed(4)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {model.test_count || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Model Metrics */}
      <section style={{ marginBottom: "3rem" }}>
        <h2>Detailed Metrics</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
          {Object.entries(metrics).map(([modelId, model]) => (
            <div
              key={modelId}
              style={{
                background: "white",
                padding: "1.5rem",
                borderRadius: "8px",
                border: "1px solid #ddd"
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>{modelId}</h3>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Overall Score:</span>
                  <span style={{ fontWeight: "bold", color: getScoreColor(model.overall_score || model.combined_score || 0) }}>
                    {(model.overall_score || model.combined_score || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Reliability:</span>
                  <span>{model.reliability?.mean?.toFixed(2) || "N/A"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Content Quality:</span>
                  <span>{model.content_quality?.mean?.toFixed(2) || "N/A"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Factual Accuracy:</span>
                  <span>{model.factual_accuracy?.mean?.toFixed(2) || "N/A"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Completeness:</span>
                  <span>{model.completeness?.mean?.toFixed(2) || "N/A"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Total Cost:</span>
                  <span>${(model.cost?.total || 0).toFixed(4)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Avg Latency:</span>
                  <span>{Math.round(model.latency?.mean || 0)}ms</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Test Count:</span>
                  <span>{model.test_count || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rankings by Category */}
      <section>
        <h2>Rankings by Category</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
          {rankings.by_reliability && (
            <div style={{ background: "white", padding: "1rem", borderRadius: "8px" }}>
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
            <div style={{ background: "white", padding: "1rem", borderRadius: "8px" }}>
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
            <div style={{ background: "white", padding: "1rem", borderRadius: "8px" }}>
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
