import type { ModelMetrics, ModelRankingStatus, RankingDetail } from "../types";
import { costPer100QualityPoints, formatMoney, getDisplayName } from "../utils";

interface RankingsSectionProps {
  rankings: {
    by_reliability?: string[];
    by_content_quality?: string[];
    by_cost_effectiveness?: string[];
  };
  rankingDetails?: {
    by_content_quality?: RankingDetail[];
    by_reliability?: RankingDetail[];
  };
  metrics: Record<string, ModelMetrics>;
  modelStatus?: Record<string, ModelRankingStatus>;
  modelDisplayNames: Record<string, string>;
}

export function RankingsSection({
  rankings,
  rankingDetails,
  metrics,
  modelStatus,
  modelDisplayNames
}: RankingsSectionProps) {
  const topQualityDetails = rankingDetails?.by_content_quality?.slice(0, 5) || [];
  const topReliabilityDetails = rankingDetails?.by_reliability?.slice(0, 5) || [];

  return (
    <section className="benchmark-section">
      <h2>Rankings by Category</h2>
      <div className="benchmark-grid benchmark-grid-auto">
        {(topReliabilityDetails.length > 0 || rankings.by_reliability) && (
          <div className="benchmark-card">
            <h3 style={{ marginTop: 0 }}>By Reliability</h3>
            <ol style={{ paddingLeft: "1.5rem" }}>
              {topReliabilityDetails.length > 0
                ? topReliabilityDetails.map((item) => {
                    const modelId = item.model_id;
                    const margin = item.margin_of_error != null ? ` +/- ${item.margin_of_error.toFixed(2)}` : "";
                    return (
                      <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                        {getDisplayName(modelId, modelDisplayNames)} ({item.score.toFixed(2)}{margin}
                        {item.is_statistical_tie && (
                          <span title={item.significance_note || "Statistical tie with adjacent rank"}>*</span>
                        )}
                        )
                      </li>
                    );
                  })
                : rankings.by_reliability?.slice(0, 5).map((modelId) => (
                    <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                      {getDisplayName(modelId, modelDisplayNames)} (
                      {metrics[modelId]?.reliability?.mean?.toFixed(2) || "N/A"})
                    </li>
                  ))}
            </ol>
          </div>
        )}
        {(topQualityDetails.length > 0 || rankings.by_content_quality) && (
          <div className="benchmark-card">
            <h3 style={{ marginTop: 0 }}>By Content Quality</h3>
            <ol style={{ paddingLeft: "1.5rem" }}>
              {topQualityDetails.length > 0
                ? topQualityDetails.map((item) => {
                    const modelId = item.model_id;
                    const margin = item.margin_of_error != null ? ` +/- ${item.margin_of_error.toFixed(2)}` : "";
                    const partial = modelStatus?.[modelId]?.is_partial;
                    return (
                      <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                        {getDisplayName(modelId, modelDisplayNames)} ({item.score.toFixed(2)}{margin}
                        {item.is_statistical_tie && (
                          <span title={item.significance_note || "Statistical tie with adjacent rank"}>*</span>
                        )}
                        )
                        {partial ? " (partial)" : ""}
                      </li>
                    );
                  })
                : rankings.by_content_quality?.slice(0, 5).map((modelId) => {
                    const partial = modelStatus?.[modelId]?.is_partial;
                    return (
                      <li key={modelId} style={{ marginBottom: "0.5rem" }}>
                        {getDisplayName(modelId, modelDisplayNames)} (
                        {metrics[modelId]?.content_quality?.mean?.toFixed(2) || "N/A"})
                        {partial ? " (partial)" : ""}
                      </li>
                    );
                  })}
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
