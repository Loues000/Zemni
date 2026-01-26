import type { OutputEntry, OutputKind } from "@/types";

/**
 * Sorts output entries by updatedAt timestamp (newest first)
 */
export const sortOutputsByDate = (outputs: OutputEntry[]): OutputEntry[] => {
  return outputs.slice().sort((a, b) => b.updatedAt - a.updatedAt);
};

/**
 * Filters outputs by output kind
 */
export const filterOutputsByKind = (
  outputs: OutputEntry[],
  kind: OutputKind
): OutputEntry[] => {
  return outputs.filter((tab) => (tab.kind ?? "summary") === kind);
};

/**
 * Converts array of outputs to a record keyed by ID
 */
export const outputsToRecord = (
  outputs: OutputEntry[]
): Record<string, OutputEntry> => {
  return outputs.reduce<Record<string, OutputEntry>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
};
