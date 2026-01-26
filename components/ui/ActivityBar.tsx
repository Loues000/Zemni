"use client";

import { useEffect, useMemo, useState } from "react";
import type { Status } from "@/types";

type ExportProgress = { current: number; total: number };

const statusLabels: Record<Status, string> = {
  idle: "Ready",
  parsing: "Parsing PDF",
  summarizing: "Generating",
  refining: "Refining",
  exporting: "Exporting",
  error: "Error",
  ready: "Ready"
};

const isBusyStatus = (status: Status): boolean =>
  status === "parsing" || status === "summarizing" || status === "refining" || status === "exporting";

const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

export function ActivityBar({
  status,
  exportProgress
}: {
  status: Status;
  exportProgress: ExportProgress | null;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (isBusyStatus(status)) {
      setStartedAt((prev) => prev ?? Date.now());
      return;
    }
    setStartedAt(null);
  }, [status]);

  useEffect(() => {
    if (!isBusyStatus(status)) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [status]);

  const percent = useMemo(() => {
    if (status !== "exporting" || !exportProgress) return null;
    if (!exportProgress.total) return null;
    const raw = (exportProgress.current / exportProgress.total) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [status, exportProgress]);

  if (!isBusyStatus(status)) return null;

  const elapsed = startedAt ? formatElapsed(Math.max(0, now - startedAt)) : null;
  const hint =
    status === "summarizing" || status === "refining"
      ? "Large PDFs / math-heavy topics can take a bit longer."
      : status === "parsing"
        ? "Extracting text…"
        : null;

  return (
    <div className="activity-bar" role="status" aria-live="polite">
      <div className="activity-bar-row">
        <div className="activity-bar-left">
          <span className="activity-bar-label">{statusLabels[status]}</span>
          {elapsed && <span className="activity-bar-elapsed">{elapsed}</span>}
        </div>
        {percent !== null && <span className="activity-bar-percent">{percent}%</span>}
      </div>
      <div className="activity-bar-track">
        <div
          className={`activity-bar-fill${percent === null ? " indeterminate" : ""}`}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      {hint && <div className="activity-bar-hint">{hint}</div>}
    </div>
  );
}

