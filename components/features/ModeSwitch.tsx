import type { OutputKind } from "@/types";

interface ModeSwitchProps {
  outputKind: OutputKind;
  onModeChange: (mode: OutputKind) => void;
  className?: string;
}

/**
 * Tab-style switch for selecting output mode.
 */
export function ModeSwitch({ outputKind, onModeChange, className = "" }: ModeSwitchProps) {
  return (
    <div className={`mode-switch ${className}`} role="tablist" aria-label="Output mode">
      <button
        type="button"
        className={`mode-btn${outputKind === "summary" ? " active" : ""}`}
        onClick={() => onModeChange("summary")}
        aria-selected={outputKind === "summary"}
      >
        Summary
      </button>
      <button
        type="button"
        className={`mode-btn${outputKind === "flashcards" ? " active" : ""}`}
        onClick={() => onModeChange("flashcards")}
        aria-selected={outputKind === "flashcards"}
      >
        Flashcards
      </button>
      <button
        type="button"
        className={`mode-btn${outputKind === "quiz" ? " active" : ""}`}
        onClick={() => onModeChange("quiz")}
        aria-selected={outputKind === "quiz"}
      >
        Quiz
      </button>
    </div>
  );
}
