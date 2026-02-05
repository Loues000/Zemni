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
 * Render a refine input bar for submitting change requests.
 *
 * Renders a form containing an input and submit button for refining a current summary; on mobile it can optionally include a close button.
 *
 * @param input - Current value of the input field
 * @param isRefining - Whether a refinement operation is in progress; disables controls and changes the submit label
 * @param hasCurrentSummary - Whether there is an existing summary available to refine; disables input and submit when false
 * @param onInputChange - Change event handler for the input element
 * @param onSubmit - Form submit handler invoked when the user submits a refinement
 * @param isMobile - If true, applies mobile styling and enables rendering of the close button
 * @param onClose - Optional handler invoked when the mobile close button is pressed
 * @returns The JSX element for the refine bar
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