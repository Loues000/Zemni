import type { Status } from "@/types";

const statusLabels: Record<Status, string> = {
  idle: "Bereit",
  parsing: "PDF wird gelesen",
  summarizing: "Generiert",
  refining: "Ueberarbeitet",
  exporting: "Exportiert",
  error: "Fehler",
  ready: "Bereit"
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
