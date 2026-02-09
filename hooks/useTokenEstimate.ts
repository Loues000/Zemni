import { useState, useCallback, useRef, useEffect } from "react";
import type { CostRow, CostHeuristic, OutputKind } from "@/types";

export function useTokenEstimate() {
  const [modelCosts, setModelCosts] = useState<CostRow[]>([]);
  const [costHeuristic, setCostHeuristic] = useState<CostHeuristic | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const estimateAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRequestRef = useRef<{ text: string; hints: string; options?: any } | null>(null);

  const fetchTokenEstimate = useCallback(async (
    text: string,
    hints: string,
    options?: { mode?: OutputKind; n?: number; sectionsCount?: number }
  ) => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!text) {
      setModelCosts([]);
      setCostHeuristic(null);
      return;
    }

    // Store the pending request parameters
    pendingRequestRef.current = { text, hints, options };

    // Debounce the request by 300ms to avoid excessive API calls during typing
    debounceTimerRef.current = setTimeout(async () => {
      // Check if this request is still the latest one
      if (!pendingRequestRef.current) return;
      
      const currentRequest = pendingRequestRef.current;
      pendingRequestRef.current = null;

      // Cancel any in-flight request
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
            extractedText: currentRequest.text,
            structureHints: currentRequest.hints,
            mode: currentRequest.options?.mode ?? "summary",
            n: currentRequest.options?.n ?? null,
            sectionsCount: currentRequest.options?.sectionsCount ?? null
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
    }, 300);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (estimateAbortRef.current) {
        estimateAbortRef.current.abort();
      }
    };
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
