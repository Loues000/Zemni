import { useEffect } from "react";
import type { UsageStats, OutputEntry } from "@/types";

interface UseRefineEffectsProps {
  chatConfig: {
    data?: any[];
  };
  refineTargetRef: React.MutableRefObject<string>;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>;
}

/**
 * Handles effects related to refine/chat functionality
 */
export function useRefineEffects({
  chatConfig,
  refineTargetRef,
  setOutputs
}: UseRefineEffectsProps): void {
  useEffect(() => {
    if (!chatConfig.data || !chatConfig.data.length) return;
    const latest = [...chatConfig.data].reverse().find((item) => {
      return typeof item === "object" && item !== null && (item as Record<string, unknown>).type === "usage";
    }) as { payload?: UsageStats } | undefined;

    if (latest?.payload) {
      const targetTabId = refineTargetRef.current;
      if (!targetTabId) return;
      setOutputs((prev) => {
        const existing = prev[targetTabId];
        if (!existing) return prev;
        return {
          ...prev,
          [targetTabId]: {
            ...existing,
            usage: latest.payload ?? null,
            updatedAt: Date.now()
          }
        };
      });
    }
  }, [chatConfig.data, setOutputs, refineTargetRef]);
}
