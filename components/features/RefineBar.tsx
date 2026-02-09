import { IconClose } from "../ui/Icons";

interface RefineBarProps {
  input: string;
  isRefining: boolean;
  hasCurrentSummary: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

/**
 * Inline form for refining the current summary.
 */
export function RefineBar({
  input,
  isRefining,
  hasCurrentSummary,
  onInputChange,
  onSubmit,
  isMobile = false,
  onClose
}: RefineBarProps) {
  return (
    <form className={`refine-bar${isMobile ? " refine-bar-hidden" : ""}`} onSubmit={onSubmit}>
      {isMobile && onClose && (
        <button
          type="button"
          className="refine-bar-close"
          onClick={onClose}
          aria-label="Close refine bar"
        >
          <IconClose />
        </button>
      )}
      <input
        value={input}
        onChange={onInputChange}
        placeholder="Request changes..."
        disabled={!hasCurrentSummary || isRefining}
      />
      <button
        type="submit"
        className="btn btn-secondary"
        disabled={!hasCurrentSummary || isRefining || !input.trim()}
      >
        {isRefining ? "Working..." : "Refine"}
      </button>
    </form>
  );
}
