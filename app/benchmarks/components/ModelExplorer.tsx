import type { BenchmarkData, BenchmarkResult, ModelMetrics, TaskFilter } from "../types";
import { costPer100QualityPoints, formatMoney, formatMs, formatTokens, formatTopicName, getDisplayName, scoreFor } from "../utils";

interface ModelExplorerProps {
  selection: { modelId: string; testKey: string };
  filters: { task: TaskFilter; topic: string; format: string };
  data: BenchmarkData;
  selectedModelMetrics: ModelMetrics | null;
  availableFormats: string[];
  selectedTest: BenchmarkResult | null;
  modelIds: string[];
  modelDisplayNames: Record<string, string>;
  onSelectModel: (modelId: string) => void;
  onSelectTest: (testKey: string) => void;
  onSetFilters: (updater: (prev: { task: TaskFilter; topic: string; format: string }) => { task: TaskFilter; topic: string; format: string }) => void;
}

export function ModelExplorer({
  selection,
  filters,
  data,
  selectedModelMetrics,
  availableFormats,
  selectedTest,
  modelIds,
  modelDisplayNames,
  onSelectModel,
  onSelectTest,
  onSetFilters,
}: ModelExplorerProps) {
  return (
    <section className="benchmark-section">
      <h2>Model Explorer</h2>
      <div className="benchmark-explorer-controls">
        <label className="benchmark-control benchmark-control-inline">
          <span className="benchmark-control-label">Model</span>
          <select
            value={selection.modelId}
            onChange={(e) => {
              onSelectModel(e.target.value);
              onSetFilters((prev) => ({ ...prev, format: "all" }));
            }}
            className="benchmark-control-input"
          >
            {modelIds.map((id) => (
              <option key={id} value={id}>
                {getDisplayName(id, modelDisplayNames)}
              </option>
            ))}
          </select>
        </label>

        <label className="benchmark-control benchmark-control-inline">
          <span className="benchmark-control-label">Format</span>
          <select
            value={filters.format}
            onChange={(e) => onSetFilters((prev) => ({ ...prev, format: e.target.value }))}
            className="benchmark-control-input"
          >
            <option value="all">All</option>
            {availableFormats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <div className="benchmark-stats-text benchmark-explorer-context">
          {filters.task !== "all" ? `Task: ${filters.task}` : "All tasks"}
          {filters.topic !== "all" ? ` | Topic: ${formatTopicName(filters.topic)}` : ""}
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
            <span className="benchmark-metric-value">
              {selectedModelMetrics.reliability?.mean?.toFixed(1) ?? "N/A"}
            </span>
          </div>
          <div className="benchmark-metric-row">
            <span className="benchmark-metric-label">Quality</span>
            <span className="benchmark-metric-value">
              {selectedModelMetrics.content_quality?.mean?.toFixed(1) ?? "N/A"}
            </span>
          </div>
          <div className="benchmark-metric-row">
            <span className="benchmark-metric-label">Cost per 100 pts</span>
            <span className="benchmark-metric-value">
              {costPer100QualityPoints(selectedModelMetrics) !== Infinity
                ? formatMoney(costPer100QualityPoints(selectedModelMetrics))
                : "N/A"}
            </span>
          </div>
          {selectedModelMetrics.total_tokens != null && (
            <div className="benchmark-metric-row">
              <span className="benchmark-metric-label">Total tokens</span>
              <span className="benchmark-metric-value">{formatTokens(selectedModelMetrics.total_tokens)}</span>
            </div>
          )}
          {selectedModelMetrics.judge_cost_total != null && (
            <div className="benchmark-metric-row">
              <span className="benchmark-metric-label">Judge cost</span>
              <span className="benchmark-metric-value">{formatMoney(selectedModelMetrics.judge_cost_total)}</span>
            </div>
          )}
          <div className="benchmark-metric-row">
            <span className="benchmark-metric-label">Total cost</span>
            <span className="benchmark-metric-value">
              {selectedModelMetrics.cost?.total != null ? formatMoney(selectedModelMetrics.cost.total) : "N/A"}
            </span>
          </div>
          <div className="benchmark-metric-row">
            <span className="benchmark-metric-label">Latency</span>
            <span className="benchmark-metric-value">
              {selectedModelMetrics.latency?.mean != null ? formatMs(selectedModelMetrics.latency.mean) : "N/A"}
            </span>
          </div>
        </div>
      )}
      {selection.modelId && (
        <>
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
                  <th className="benchmark-th-right">Tokens</th>
                  <th className="benchmark-th-right">Latency</th>
                </tr>
              </thead>
              <tbody>
                {data.results
                  .filter((r) => r.model_id === selection.modelId)
                  .filter((r) => (filters.task === "all" ? true : r.task === filters.task))
                  .filter((r) => (filters.topic === "all" ? true : r.test_case_topic === filters.topic))
                  .filter((r) => (filters.format === "all" ? true : r.test_case_format === filters.format))
                  .sort((a, b) => a.test_case_id.localeCompare(b.test_case_id))
                  .map((r) => {
                    const key = `${r.model_id}::${r.task}::${r.test_case_id}`;
                    const isSelected = key === selection.testKey;
                    return (
                      <tr
                        key={key}
                        className={isSelected ? "benchmark-row-selected" : undefined}
                        onClick={() => onSelectTest(key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") onSelectTest(key);
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
                        <td className="benchmark-td-right">
                          {typeof r.cost === "number" ? formatMoney(r.cost) : "N/A"}
                        </td>
                        <td className="benchmark-td-right">
                          {r.usage?.total_tokens ? formatTokens(r.usage.total_tokens) : "N/A"}
                        </td>
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
        </>
      )}
    </section>
  );
}
