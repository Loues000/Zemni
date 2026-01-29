import type { ComprehensiveMetrics } from "../types";
import { getDisplayName, scoreFor } from "../utils";

interface TaskPerformanceSectionProps {
  metricsComprehensive: Record<string, ComprehensiveMetrics>;
  collapsedTaskSections: Record<string, boolean>;
  onToggleTaskSection: (modelId: string, task: string) => void;
  modelDisplayNames: Record<string, string>;
}

export function TaskPerformanceSection({
  metricsComprehensive,
  collapsedTaskSections,
  onToggleTaskSection,
  modelDisplayNames,
}: TaskPerformanceSectionProps) {
  if (!metricsComprehensive || Object.keys(metricsComprehensive).length === 0) return null;

  return (
    <section className="benchmark-section">
      <h2>Task-Specific Performance</h2>
      <div className="benchmark-grid benchmark-grid-300">
        {Object.entries(metricsComprehensive).map(([modelId, comp]) => {
          if (!comp.by_task || Object.keys(comp.by_task).length === 0) return null;
          return (
            <div key={modelId} className="benchmark-card">
              <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1rem" }}>
                {getDisplayName(modelId, modelDisplayNames)}
              </h3>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {(["summary", "quiz", "flashcards"] as const).map((task) => {
                  const taskMetrics = comp.by_task?.[task];
                  const hasData = taskMetrics && taskMetrics.test_count && taskMetrics.test_count > 0;
                  const isTested = comp.summary_stats?.tasks_tested?.includes(task);
                  const key = `${modelId}::${task}`;
                  const isCollapsible = task === "quiz" || task === "flashcards";
                  const isCollapsed = isCollapsible && (collapsedTaskSections[key] ?? true); // Default to collapsed

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
                              onClick={() => onToggleTaskSection(modelId, task)}
                            >
                              {isCollapsed ? "Expand" : "Collapse"}
                            </button>
                          )}
                        </h4>
                        <div
                          style={{
                            padding: "1rem",
                            textAlign: "center",
                            color: "var(--text-secondary)",
                            fontStyle: "italic",
                          }}
                        >
                          Data will be added later
                        </div>
                      </div>
                    );
                  }

                  if (!taskMetrics) return null;

                  const taskScore = scoreFor(taskMetrics);
                  const taskScoreClass =
                    taskScore >= 80 ? "benchmark-score-high" : taskScore >= 60 ? "benchmark-score-medium" : "benchmark-score-low";
                  return (
                    <div key={task} className="benchmark-task-section">
                      <h4 className="benchmark-task-title">
                        {task}
                        {isCollapsible && (
                          <button
                            type="button"
                            style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}
                            onClick={() => onToggleTaskSection(modelId, task)}
                          >
                            {isCollapsed ? "Expand" : "Collapse"}
                          </button>
                        )}
                      </h4>
                      {!isCollapsed && (
                        <>
                          <div className="benchmark-metric-row" style={{ fontSize: "0.9rem" }}>
                            <span className="benchmark-metric-label">Score:</span>
                            <span className={`benchmark-metric-value ${taskScoreClass}`}>{taskScore.toFixed(1)}</span>
                          </div>
                          <div className="benchmark-metric-row" style={{ fontSize: "0.9rem" }}>
                            <span className="benchmark-metric-label">Rel:</span>
                            <span className="benchmark-metric-value">
                              {taskMetrics.reliability?.mean?.toFixed(1) || "N/A"}
                            </span>
                          </div>
                          <div className="benchmark-metric-row" style={{ fontSize: "0.9rem" }}>
                            <span className="benchmark-metric-label">Qual:</span>
                            <span className="benchmark-metric-value">
                              {taskMetrics.content_quality?.mean?.toFixed(1) || "N/A"}
                            </span>
                          </div>
                          <div className="benchmark-metric-row" style={{ fontSize: "0.9rem" }}>
                            <span className="benchmark-metric-label">Tests:</span>
                            <span className="benchmark-metric-value">{taskMetrics.test_count || 0}</span>
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
  );
}
