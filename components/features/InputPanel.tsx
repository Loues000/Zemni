import type { Model } from "@/types";
import { ModelSelector } from "@/components/ui";

interface InputPanelProps {
  fileName: string;
  selectedModel: string;
  models: Model[];
  structureHints: string;
  showStructureHints?: boolean;
  dragActive: boolean;
  dropzoneCorner?: React.ReactNode;
  topBarLeft?: React.ReactNode;
  topBarRight?: React.ReactNode;
  userTier?: string | null;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onSelectFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onModelChange: (value: string) => void;
  onStructureChange: (value: string) => void;
  children?: React.ReactNode;
}

/**
 * Render the input panel used to upload a document, choose a model, and optionally provide structure hints.
 *
 * @param fileName - Current uploaded file name; empty when no file is selected
 * @param selectedModel - ID of the currently selected model
 * @param models - Available models to present in the model selector
 * @param structureHints - Current text for the optional structure hints textarea
 * @param showStructureHints - When true, show the Structure (optional) textarea
 * @param dragActive - When true, apply drag styling to the dropzone
 * @param dropzoneCorner - Optional node rendered in the top-right corner of the dropzone
 * @param topBarLeft - Optional content for the left side of the panel top bar
 * @param topBarRight - Optional content for the right side of the panel top bar
 * @param userTier - Optional user tier used to tailor model selector options
 * @param onDrop - Handler invoked when a file is dropped onto the dropzone
 * @param onDragOver - Handler invoked while a dragged item is over the dropzone
 * @param onDragLeave - Handler invoked when a dragged item leaves the dropzone
 * @param onSelectFile - Handler invoked when a file is selected via the hidden file input
 * @param onModelChange - Handler invoked with the new model id when model selection changes
 * @param onStructureChange - Handler invoked with the new structure hints text when the textarea changes
 * @param children - Additional nodes to render below the panel fields
 * @returns The panel's React element containing the dropzone, model selector, optional structure hints, and any children
 */
export function InputPanel({
  fileName,
  selectedModel,
  models,
  structureHints,
  showStructureHints = true,
  dragActive,
  dropzoneCorner,
  topBarLeft,
  topBarRight,
  userTier,
  onDrop,
  onDragOver,
  onDragLeave,
  onSelectFile,
  onModelChange,
  onStructureChange,
  children
}: InputPanelProps) {
  return (
    <div className="input-panel">
      {(topBarLeft || topBarRight) && (
        <div className="input-panel-topbar">
          <div className="input-panel-topbar-left">{topBarLeft}</div>
          <div className="input-panel-topbar-right">{topBarRight}</div>
        </div>
      )}
      <div
        className={`dropzone${dragActive ? " drag" : ""}${fileName ? " has-file" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
      >
        {dropzoneCorner && <div className="dropzone-corner">{dropzoneCorner}</div>}
        {!fileName && (
          <div className="dropzone-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
        )}
        <div className="dropzone-label">
          {fileName || "Upload your document"}
        </div>
        <div className="dropzone-hint">
          {fileName ? "Click to upload a new file" : "Drop PDF or Markdown here, or click to browse"}
        </div>
        <input
          type="file"
          accept="application/pdf,text/markdown,.md"
          onChange={onSelectFile}
          hidden
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="model-selector">Model</label>
        <ModelSelector
          id="model-selector"
          models={models}
          userTier={userTier}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
        />
      </div>

      {showStructureHints && (
        <div className="field">
          <label className="field-label">Structure (optional)</label>
          <textarea
            rows={2}
            placeholder="e.g. Introduction, Key terms"
            value={structureHints}
            onChange={(e) => onStructureChange(e.target.value)}
          />
        </div>
      )}

      {children}
    </div>
  );
}