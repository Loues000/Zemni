import type { UsageStats } from "@/types";
import { IconChevron } from "./Icons";

export function StatsSection({ 
  currentUsage, 
  isOpen, 
  onToggle 
}: { 
  currentUsage: UsageStats | null; 
  isOpen: boolean; 
  onToggle: () => void;
}) {
  if (!currentUsage) return null;

  const formatNumber = (value: number | null, digits: number = 0): string => {
    if (value === null || Number.isNaN(value)) return "-";
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
  };

  const formatMoney = (value: number | null, currency: string): string => {
    if (value === null || Number.isNaN(value)) return "-";
    return value.toFixed(4) + " " + currency;
  };

  const formatSeconds = (ms: number | null): string => {
    if (!ms) return "-";
    return (ms / 1000).toFixed(2) + "s";
  };

  return (
    <div className="stats-section">
      <button
        type="button"
        className="stats-toggle"
        onClick={onToggle}
      >
        <span>OpenRouter Stats</span>
        <span className={`stats-toggle-icon${isOpen ? " open" : ""}`}>
          <IconChevron />
        </span>
      </button>
      <div className={`stats-content${isOpen ? " open" : ""}`}>
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-label">Prompt</div>
            <div className="stat-value">{formatNumber(currentUsage.promptTokens)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Output</div>
            <div className="stat-value">{formatNumber(currentUsage.completionTokens)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Tok/s</div>
            <div className="stat-value">{formatNumber(currentUsage.tokensPerSecond, 1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Duration</div>
            <div className="stat-value">{formatSeconds(currentUsage.durationMs)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Cost</div>
            <div className="stat-value">
              {currentUsage.currency
                ? formatMoney(currentUsage.costTotal, currentUsage.currency)
                : "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
