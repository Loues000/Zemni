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
