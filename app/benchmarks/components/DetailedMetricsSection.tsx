import type { ComprehensiveMetrics, ModelMetrics } from "../types";
import { getDisplayName, scoreFor } from "../utils";

interface DetailedMetricsSectionProps {
  metrics: Record<string, ModelMetrics>;
  metricsComprehensive?: Record<string, ComprehensiveMetrics>;
  modelDisplayNames: Record<string, string>;
}

export function DetailedMetricsSection({
  metrics,
  metricsComprehensive,
  modelDisplayNames,
}: DetailedMetricsSectionProps) {
  return (
    <section className="benchmark-section">
      <h2>Detailed Metrics</h2>
      <div className="benchmark-grid benchmark-grid-auto">
        {Object.entries(metrics).map(([modelId, model]) => {
          const comp = metricsComprehensive?.[modelId];
          const modelScore = scoreFor(model);
          const modelScoreClass =
            modelScore >= 80 ? "benchmark-score-high" : modelScore >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
          return (
            <div key={modelId} className="benchmark-card">
              <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>{getDisplayName(modelId, modelDisplayNames)}</h3>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div className="benchmark-metric-row">
                  <span className="benchmark-metric-label">Overall Score:</span>
                  <span className={`benchmark-metric-value ${modelScoreClass}`}>{modelScore.toFixed(2)}</span>
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
  );
}
