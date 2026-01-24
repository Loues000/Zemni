import { useState, useCallback, useRef, useEffect } from "react";
import type { CostRow, CostHeuristic, OutputKind } from "@/types";

export function useTokenEstimate() {
  const [modelCosts, setModelCosts] = useState<CostRow[]>([]);
  const [costHeuristic, setCostHeuristic] = useState<CostHeuristic | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const estimateAbortRef = useRef<AbortController | null>(null);

  const fetchTokenEstimate = useCallback(async (
    text: string,
    hints: string,
    options?: { mode?: OutputKind; n?: number; sectionsCount?: number }
  ) => {
    if (!text) {
      setModelCosts([]);
      setCostHeuristic(null);
      return;
    }

    if (estimateAbortRef.current) {
      estimateAbortRef.current.abort();
    }
    estimateAbortRef.current = new AbortController();

    setIsEstimating(true);
    try {
      const res = await fetch("/api/token-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedText: text,
          structureHints: hints,
          mode: options?.mode ?? "summary",
          n: options?.n ?? null,
          sectionsCount: options?.sectionsCount ?? null
        }),
        signal: estimateAbortRef.current.signal
      });
      if (!res.ok) throw new Error("Token estimate failed");
      const data = await res.json() as { modelCosts: CostRow[]; heuristic: CostHeuristic };
      setModelCosts(data.modelCosts || []);
      setCostHeuristic(data.heuristic || null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
    } finally {
      setIsEstimating(false);
    }
  }, []);

  return { 
    modelCosts, 
    costHeuristic, 
    isEstimating, 
    fetchTokenEstimate,
    setModelCosts,
    setCostHeuristic
  };
}
