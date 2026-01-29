import { useEffect, useState } from "react";
import type { BenchmarkData } from "../types";

export function useBenchmarkData() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelDisplayNames, setModelDisplayNames] = useState<Record<string, string>>({});

  // Load model display names
  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        const displayMap: Record<string, string> = {};
        data.models?.forEach((model: { id: string; displayName: string }) => {
          displayMap[model.id] = model.displayName;
        });
        setModelDisplayNames(displayMap);
      })
      .catch(() => {
        // Silently fail - will fallback to model IDs
      });
  }, []);

  // Load benchmark data
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/benchmarks", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { data, loading, error, modelDisplayNames };
}
