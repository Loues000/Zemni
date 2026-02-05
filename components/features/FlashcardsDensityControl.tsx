"use client";

import { estimateFlashcardsPerSection } from "@/lib/study-heuristics";

export type FlashcardsDensity = 1 | 2 | 3;

type FlashcardsDensityControlProps = {
  value: FlashcardsDensity;
  onChange: (value: FlashcardsDensity) => void;
  disabled?: boolean;
  totalChars?: number;
};

/**
 * Map density value to a short label.
 */
const labelFor = (value: FlashcardsDensity): string => {
  if (value === 1) return "Few";
  if (value === 2) return "Balanced";
  return "Many";
};

/**
 * Map density value to a tooltip description.
 */
const titleFor = (value: FlashcardsDensity): string => {
  if (value === 1) return "Fewer cards per document section";
  if (value === 2) return "Balanced amount of cards per section";
  return "More cards per document section";
};

/**
 * Toggle control for flashcard density selection.
 */
export function FlashcardsDensityControl({ value, onChange, disabled, totalChars }: FlashcardsDensityControlProps) {
  const values: FlashcardsDensity[] = [1, 2, 3];
  return (
    <div className="density-switch" role="group" aria-label="Flashcards amount">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className={"density-btn" + (v === value ? " active" : "")}
          onClick={() => onChange(v)}
          disabled={disabled}
          title={titleFor(v)}
          aria-pressed={v === value}
        >
          <span className="density-label">{labelFor(v)}</span>
          {typeof totalChars === "number" && totalChars > 0 && (
            <span className="density-meta">
              ~{estimateFlashcardsPerSection(totalChars, v)} cards
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
