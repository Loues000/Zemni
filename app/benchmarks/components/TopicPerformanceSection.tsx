import type { ComprehensiveMetrics, ModelMetrics } from "../types";
import { formatTopicName, getDisplayName, scoreFor } from "../utils";

interface TopicPerformanceSectionProps {
  topicsList: string[];
  metricsComprehensive: Record<string, ComprehensiveMetrics>;
  modelDisplayNames: Record<string, string>;
}

export function TopicPerformanceSection({
  topicsList,
  metricsComprehensive,
  modelDisplayNames,
}: TopicPerformanceSectionProps) {
  if (!metricsComprehensive || Object.keys(metricsComprehensive).length === 0) return null;

  return (
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
          topicMetrics.sort(
            (a, b) =>
              (b.metrics.overall_score || b.metrics.combined_score || 0) -
              (a.metrics.overall_score || a.metrics.combined_score || 0)
          );

          return (
            <div key={topic} className="benchmark-card">
              <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>{formatTopicName(topic)}</h3>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {topicMetrics.slice(0, 5).map(({ modelId, metrics }, idx) => {
                  const topicScore = scoreFor(metrics);
                  const topicScoreClass =
                    topicScore >= 80 ? "benchmark-score-high" : topicScore >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
                  return (
                    <div key={modelId} className="benchmark-topic-card">
                      <div className="benchmark-topic-header">
                        <span style={{ fontWeight: "600" }}>
                          #{idx + 1} {getDisplayName(modelId, modelDisplayNames)}
                        </span>
                        <span className={`benchmark-metric-value ${topicScoreClass}`}>{topicScore.toFixed(1)}</span>
                      </div>
                      <div className="benchmark-topic-stats">
                        Rel: {metrics.reliability?.mean?.toFixed(1)} | Qual: {metrics.content_quality?.mean?.toFixed(1)} | Tests:{" "}
                        {metrics.test_count}
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
  );
}
