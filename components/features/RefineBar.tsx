interface RefineBarProps {
  input: string;
  isRefining: boolean;
  hasCurrentSummary: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function RefineBar({
  input,
  isRefining,
  hasCurrentSummary,
  onInputChange,
  onSubmit
}: RefineBarProps) {
  return (
    <form className="refine-bar" onSubmit={onSubmit}>
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
