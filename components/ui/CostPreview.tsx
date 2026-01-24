"use client";

import { useEffect, useState } from "react";
import type { CostRow, CostHeuristic } from "@/types";
import { IconChevron } from "./Icons";

export function CostPreview({
  currentCost,
  isEstimating,
  costHeuristic,
  defaultCollapsed = false
}: {
  currentCost?: CostRow;
  isEstimating: boolean;
  costHeuristic?: CostHeuristic | null;
  defaultCollapsed?: boolean;
}) {
  if (!currentCost) return null;

  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

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
    <div className={"cost-preview" + (collapsed ? " collapsed" : "")}>
      <button
        type="button"
        className="cost-preview-title cost-preview-toggle"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <span>
          Cost estimate
          {isEstimating && <span className="estimating-indicator"> (calculating...)</span>}
        </span>
        <span className={"cost-preview-chevron" + (collapsed ? " collapsed" : "")} aria-hidden="true">
          <IconChevron />
        </span>
      </button>

      {!collapsed && (
        <div className="cost-preview-body">
          <div className="cost-row">
            <span>
              Input <span className="cost-row-tokens">({formatNumber(currentCost.tokensIn)} Tokens)</span>
            </span>
            <strong>{formatMoney(currentCost.costIn, currentCost.currency)}</strong>
          </div>
          <div className="cost-row">
            <span>
              Output <span className="cost-row-tokens">(~{formatNumber(currentCost.tokensOut)} Tokens)</span>
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
      )}
    </div>
  );
}
