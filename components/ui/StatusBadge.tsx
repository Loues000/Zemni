import type { Status } from "@/types";

const statusLabels: Record<Status, string> = {
  idle: "Ready",
  parsing: "Parsing PDF",
  summarizing: "Generating",
  refining: "Refining",
  exporting: "Exporting",
  error: "Error",
  ready: "Ready"
};

export function StatusBadge({ status }: { status: Status }) {
  const statusClass = status === "error" ? "error" : status === "ready" ? "ready" : "busy";
  
  return (
    <div className="status-badge">
      <span className={`status-dot ${statusClass}`} />
      <span className="status-text">{statusLabels[status]}</span>
    </div>
  );
}
