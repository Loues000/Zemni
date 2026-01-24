"use client";

export type FlashcardsDensity = 1 | 2 | 3;

type FlashcardsDensityControlProps = {
  value: FlashcardsDensity;
  onChange: (value: FlashcardsDensity) => void;
  disabled?: boolean;
};

const labelFor = (value: FlashcardsDensity): string => {
  if (value === 1) return "Low";
  if (value === 2) return "Medium";
  return "High";
};

const titleFor = (value: FlashcardsDensity): string => {
  if (value === 1) return "Low coverage (fewer cards)";
  if (value === 2) return "Medium coverage";
  return "High coverage (more cards)";
};

export function FlashcardsDensityControl({ value, onChange, disabled }: FlashcardsDensityControlProps) {
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
          {labelFor(v)}
        </button>
      ))}
    </div>
  );
}
