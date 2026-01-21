import type { CostRow, CostHeuristic } from "@/types";

export function CostPreview({ 
  currentCost, 
  isEstimating, 
  costHeuristic 
}: { 
  currentCost?: CostRow; 
  isEstimating: boolean; 
  costHeuristic?: CostHeuristic | null;
}) {
  if (!currentCost) return null;

  const formatMoney = (value: number | null, currency: string): string => {
    if (value === null || Number.isNaN(value)) return "-";
    return value.toFixed(4) + " " + currency;
  };

  const formatNumber = (value: number | null, digits: number = 0): string => {
    if (value === null || Number.isNaN(value)) return "-";
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
  };

  return (
    <div className="cost-preview">
      <div className="cost-preview-title">
        Kostenvorschau
        {isEstimating && <span className="estimating-indicator"> (berechnet...)</span>}
      </div>
      <div className="cost-row">
        <span>Input ({formatNumber(currentCost.tokensIn)} Tokens)</span>
        <strong>{formatMoney(currentCost.costIn, currentCost.currency)}</strong>
      </div>
      <div className="cost-row">
        <span>
          Output (~{formatNumber(currentCost.tokensOut)} Tokens)
          {costHeuristic && (
            <span className="heuristic-hint" title={`min(${costHeuristic.outputCap}, Input × ${costHeuristic.outputRatio})`}>
              *
            </span>
          )}
        </span>
        <strong>{formatMoney(currentCost.costOut, currentCost.currency)}</strong>
      </div>
      <div className="cost-row cost-row-total">
        <span>Gesamt</span>
        <strong>{formatMoney(currentCost.total, currentCost.currency)}</strong>
      </div>
      {costHeuristic && (
        <div className="cost-hint">
          * Output-Schaetzung: min({costHeuristic.outputCap}, Input × {costHeuristic.outputRatio})
        </div>
      )}
    </div>
  );
}
