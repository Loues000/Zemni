import { useState } from "react";
import type { TaskFilter, TopicFilter, SortKey } from "../types";

export function useBenchmarkFilters() {
  const [filters, setFilters] = useState({
    task: "all" as TaskFilter,
    topic: "all" as TopicFilter,
    format: "all" as string,
  });

  const [view, setView] = useState({
    sortKey: "score" as SortKey,
    sortDir: "desc" as "asc" | "desc",
    leaderboardLimit: 20,
    modelQuery: "",
  });

  const [selection, setSelection] = useState({
    modelId: "",
    testKey: "",
  });

  const [collapsedTaskSections, setCollapsedTaskSections] = useState<Record<string, boolean>>({});

  return {
    filters,
    setFilters,
    view,
    setView,
    selection,
    setSelection,
    collapsedTaskSections,
    setCollapsedTaskSections,
  };
}
