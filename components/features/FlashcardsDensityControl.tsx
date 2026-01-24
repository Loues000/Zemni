"use client";

export type FlashcardsDensity = 1 | 2 | 3;

type FlashcardsDensityControlProps = {
  value: FlashcardsDensity;
  onChange: (value: FlashcardsDensity) => void;
  disabled?: boolean;
};

const labelFor = (value: FlashcardsDensity): string => {
  if (value === 1) return "1";
  if (value === 2) return "2";
  return "3";
};

const titleFor = (value: FlashcardsDensity): string => {
  if (value === 1) return "Low (approx. 35%)";
  if (value === 2) return "Normal (approx. 60%)";
  return "High (approx. 90%)";
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
