"use client";

import { useEffect, useMemo, useState } from "react";
import type { Status, OutputKind } from "@/types";
import { getEstimatedCompletionTime, formatEstimatedTime } from "@/lib/ai-performance";

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

const modeLabels: Record<OutputKind, string> = {
  summary: "Summary",
  flashcards: "Flashcards",
  quiz: "Quiz"
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

// Get the current stage based on status
const getStage = (status: Status): { stage: "input" | "processing" | "output"; label: string } => {
  switch (status) {
    case "parsing":
      return { stage: "input", label: "Reading Input" };
    case "summarizing":
    case "refining":
      return { stage: "processing", label: "AI Processing" };
    case "exporting":
      return { stage: "output", label: "Preparing Output" };
    default:
      return { stage: "processing", label: "Working" };
  }
};

interface ActivityBarProps {
  status: Status;
  exportProgress: ExportProgress | null;
  outputKind: OutputKind;
  documentSize?: number;
  modelId?: string;
  onCancel?: () => void;
  isCancellable?: boolean;
}

/**
 * Displays an activity bar for ongoing document processing, showing stage, status label, elapsed time, estimated completion, export progress, and an optional cancel control.
 *
 * @param status - Current processing status
 * @param exportProgress - Progress object with `current` and `total` for export phase, or `null`
 * @param outputKind - The kind of output being produced (affects mode label)
 * @param documentSize - Optional approximate document size used to estimate completion time (defaults to 10000)
 * @param modelId - Optional model identifier used to compute estimated completion time
 * @param onCancel - Optional callback invoked when the user requests cancellation
 * @param isCancellable - Whether the cancel control should be shown
 * @returns The activity bar element when the status indicates ongoing work (parsing, summarizing, refining, or exporting); otherwise `null`.
 */
export function ActivityBar({
  status,
  exportProgress,
  outputKind,
  documentSize,
  modelId,
  onCancel,
  isCancellable
}: ActivityBarProps) {
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

  const estimatedTime = useMemo(() => {
    if (!modelId || !isBusyStatus(status) || status === "exporting" || status === "parsing") {
      return null;
    }
    const estimatedSeconds = getEstimatedCompletionTime(modelId, documentSize || 10000, outputKind);
    return formatEstimatedTime(estimatedSeconds);
  }, [modelId, documentSize, status, outputKind]);

  if (!isBusyStatus(status)) return null;

  const elapsed = startedAt ? formatElapsed(Math.max(0, now - startedAt)) : null;
  const stage = getStage(status);
  const modeLabel = modeLabels[outputKind];

  return (
    <div className="activity-bar" role="status" aria-live="polite">
      <div className="activity-bar-row">
        <div className="activity-bar-left">
          <span className="activity-bar-mode">{modeLabel}</span>
          <span className="activity-bar-label">{statusLabels[status]}</span>
          {elapsed && <span className="activity-bar-elapsed">{elapsed}</span>}
          {estimatedTime && (
            <span className="activity-bar-estimated" title="Estimated completion time">
              {estimatedTime}
            </span>
          )}
        </div>
        <div className="activity-bar-right">
          {percent !== null && <span className="activity-bar-percent">{percent}%</span>}
          {isCancellable && onCancel && (
            <button
              type="button"
              className="activity-bar-cancel"
              onClick={onCancel}
              title="Cancel generation"
              aria-label="Cancel generation"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 7L3 3M7 7L11 11M7 7L11 3M7 7L3 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Stage indicator */}
      <div className="activity-bar-stages">
        <div className={`activity-bar-stage ${stage.stage === "input" ? "active" : ""} ${stage.stage === "processing" || stage.stage === "output" ? "completed" : ""}`}>
          <div className="activity-bar-stage-dot" />
          <span>Input</span>
        </div>
        <div className="activity-bar-stage-line" />
        <div className={`activity-bar-stage ${stage.stage === "processing" ? "active" : ""} ${stage.stage === "output" ? "completed" : ""}`}>
          <div className="activity-bar-stage-dot" />
          <span>Processing</span>
        </div>
        <div className="activity-bar-stage-line" />
        <div className={`activity-bar-stage ${stage.stage === "output" ? "active" : ""}`}>
          <div className="activity-bar-stage-dot" />
          <span>Output</span>
        </div>
      </div>

      <div className="activity-bar-track">
        <div
          className={`activity-bar-fill${percent === null ? " indeterminate" : ""}`}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  );
}