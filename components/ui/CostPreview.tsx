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

  const note = costHeuristic?.note ?? (costHeuristic ? `Output estimate (cap ${costHeuristic.outputCap})` : null);

  return (
    <div className="cost-preview">
      <div className="cost-preview-title">
        Cost estimate
        {isEstimating && <span className="estimating-indicator"> (calculating...)</span>}
      </div>
      <div className="cost-row">
        <span>Input ({formatNumber(currentCost.tokensIn)} Tokens)</span>
        <strong>{formatMoney(currentCost.costIn, currentCost.currency)}</strong>
      </div>
      <div className="cost-row">
        <span>
          Output (~{formatNumber(currentCost.tokensOut)} Tokens)
          {note && (
            <span className="heuristic-hint" title={note}>
              *
            </span>
          )}
        </span>
        <strong>{formatMoney(currentCost.costOut, currentCost.currency)}</strong>
      </div>
      <div className="cost-row cost-row-total">
        <span>Total</span>
        <strong>{formatMoney(currentCost.total, currentCost.currency)}</strong>
      </div>
      {note && <div className="cost-hint">* {note}</div>}
    </div>
  );
}
