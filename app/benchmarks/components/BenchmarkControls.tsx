import type { SortKey, TaskFilter } from "../types";
import { defaultSortDirForKey, formatTopicName } from "../utils";

interface BenchmarkControlsProps {
  filters: { task: TaskFilter; topic: string; format: string };
  view: { sortKey: SortKey; sortDir: "asc" | "desc"; leaderboardLimit: number; modelQuery: string };
  topicsList: string[];
  setFilters: (updater: (prev: { task: TaskFilter; topic: string; format: string }) => { task: TaskFilter; topic: string; format: string }) => void;
  setView: (updater: (prev: { sortKey: SortKey; sortDir: "asc" | "desc"; leaderboardLimit: number; modelQuery: string }) => { sortKey: SortKey; sortDir: "asc" | "desc"; leaderboardLimit: number; modelQuery: string }) => void;
}

export function BenchmarkControls({
  filters,
  view,
  topicsList,
  setFilters,
  setView,
}: BenchmarkControlsProps) {
  return (
    <div className="benchmark-controls" role="region" aria-label="Benchmark filters">
      <div className="benchmark-controls-row">
        <div className="benchmark-segment" role="tablist" aria-label="Task filter">
          {(["all", "summary", "quiz", "flashcards"] as TaskFilter[]).map((task) => (
            <button
              key={task}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, task }))}
              aria-pressed={filters.task === task}
              className={`benchmark-button ${filters.task === task ? "benchmark-button-active" : ""}`}
            >
              {task === "all" ? "All" : task}
            </button>
          ))}
        </div>

        <label className="benchmark-control">
          <span className="benchmark-control-label">Topic</span>
          <select
            value={filters.topic}
            onChange={(e) => setFilters((prev) => ({ ...prev, topic: e.target.value }))}
            className="benchmark-control-input"
          >
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
            value={view.sortKey}
            onChange={(e) => {
              const nextKey = e.target.value as SortKey;
              setView((prev) => ({
                ...prev,
                sortKey: nextKey,
                sortDir: defaultSortDirForKey(nextKey),
              }));
            }}
            className="benchmark-control-input"
          >
            <option value="score">Score</option>
            <option value="reliability">Reliability</option>
            <option value="content_quality">Content quality</option>
            <option value="cost_per_quality">Cost per 100 pts</option>
            <option value="total_cost">Total cost</option>
            <option value="latency">Latency</option>
            <option value="tests">Tests</option>
          </select>
        </label>

        <label className="benchmark-control">
          <span className="benchmark-control-label">Show</span>
          <select
            value={view.leaderboardLimit}
            onChange={(e) => setView((prev) => ({ ...prev, leaderboardLimit: Number(e.target.value) }))}
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
            value={view.modelQuery}
            onChange={(e) => setView((prev) => ({ ...prev, modelQuery: e.target.value }))}
            placeholder="Filter by model name..."
            className="benchmark-control-input"
          />
        </label>

        <button
          type="button"
          className="benchmark-control-button"
          onClick={() => setView((prev) => ({ ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc" }))}
          aria-label={`Toggle sort direction (currently ${view.sortDir})`}
          title={`Sort: ${view.sortDir === "asc" ? "ascending" : "descending"}`}
        >
          {view.sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>
    </div>
  );
}
