import type { ModelMetrics } from "../types";
import { costPer100QualityPoints, formatMoney, getDisplayName } from "../utils";

interface RankingsSectionProps {
  rankings: {
    by_reliability?: string[];
    by_content_quality?: string[];
    by_cost_effectiveness?: string[];
  };
  metrics: Record<string, ModelMetrics>;
  modelDisplayNames: Record<string, string>;
}

export function RankingsSection({ rankings, metrics, modelDisplayNames }: RankingsSectionProps) {
  return (
    <section className="benchmark-section">
      <h2>Rankings by Category</h2>
      <div className="benchmark-grid benchmark-grid-auto">
        {rankings.by_reliability && (
          <div className="benchmark-card">
            <h3 style={{ marginTop: 0 }}>By Reliability</h3>
            <ol style={{ paddingLeft: "1.5rem" }}>
              {rankings.by_reliability.slice(0, 5).map((modelId) => (
                <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                  {getDisplayName(modelId, modelDisplayNames)} ({metrics[modelId]?.reliability?.mean?.toFixed(2) || "N/A"})
                </li>
              ))}
            </ol>
          </div>
        )}
        {rankings.by_content_quality && (
          <div className="benchmark-card">
            <h3 style={{ marginTop: 0 }}>By Content Quality</h3>
            <ol style={{ paddingLeft: "1.5rem" }}>
              {rankings.by_content_quality.slice(0, 5).map((modelId) => (
                <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                  {getDisplayName(modelId, modelDisplayNames)} ({metrics[modelId]?.content_quality?.mean?.toFixed(2) || "N/A"})
                </li>
              ))}
            </ol>
          </div>
        )}
        {rankings.by_cost_effectiveness && (
          <div className="benchmark-card">
            <h3 style={{ marginTop: 0 }}>By Cost Effectiveness</h3>
            <ol style={{ paddingLeft: "1.5rem" }}>
              {rankings.by_cost_effectiveness.slice(0, 5).map((modelId) => {
                const m = metrics[modelId];
                const costPer100 = m ? costPer100QualityPoints(m) : Infinity;
                return (
                  <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                    {getDisplayName(modelId, modelDisplayNames)} ({costPer100 !== Infinity ? formatMoney(costPer100) : "N/A"})
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
