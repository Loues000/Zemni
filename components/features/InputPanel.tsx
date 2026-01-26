import type { Model } from "@/types";

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
        className={`dropzone${dragActive ? " drag" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
      >
        {dropzoneCorner && <div className="dropzone-corner">{dropzoneCorner}</div>}
        <div className="dropzone-label">
          {fileName || "Upload PDF/MD"}
        </div>
        <div className="dropzone-hint">
          {fileName ? "Click to upload a new file" : "Drop here or click"}
        </div>
        <input
          type="file"
          accept="application/pdf,text/markdown,.md"
          onChange={onSelectFile}
          hidden
        />
      </div>

      <div className="field">
        <label className="field-label">Model</label>
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </select>
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
