import type { ModelMetrics, SortKey } from "./types";

export const clamp0to100 = (n: number) => Math.max(0, Math.min(100, n));

export const scoreFor = (m: ModelMetrics | null) => (m?.overall_score || m?.combined_score || 0);

export const formatMoney = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(4)}`;

export const formatMs = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0)}ms`;

export const formatTokens = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

export const formatTopicName = (topic: string) => {
  return topic.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

export const getDisplayName = (modelId: string, modelDisplayNames: Record<string, string>) => {
  return modelDisplayNames[modelId] || modelId;
};

export const costPer100QualityPoints = (m: ModelMetrics | null): number => {
  if (!m || !m.cost?.total || !m.content_quality?.mean || m.content_quality.mean === 0) return Infinity;
  return (m.cost.total / m.content_quality.mean) * 100;
};

export const defaultSortDirForKey = (key: SortKey): "asc" | "desc" => {
  if (key === "cost_per_quality" || key === "total_cost" || key === "latency") return "asc";
  return "desc";
};
