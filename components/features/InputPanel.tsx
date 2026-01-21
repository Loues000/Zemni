import type { Model, Subject } from "@/types";

interface InputPanelProps {
  fileName: string;
  selectedSubject: string;
  subjects: Subject[];
  selectedModel: string;
  models: Model[];
  structureHints: string;
  dragActive: boolean;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onSelectFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubjectChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onStructureChange: (value: string) => void;
  children?: React.ReactNode;
}

export function InputPanel({
  fileName,
  selectedSubject,
  subjects,
  selectedModel,
  models,
  structureHints,
  dragActive,
  onDrop,
  onDragOver,
  onDragLeave,
  onSelectFile,
  onSubjectChange,
  onModelChange,
  onStructureChange,
  children
}: InputPanelProps) {
  return (
    <div className="input-panel">
      <div
        className={`dropzone${dragActive ? " drag" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
      >
        <div className="dropzone-label">
          {fileName || "PDF hochladen"}
        </div>
        <div className="dropzone-hint">
          {fileName ? "Klicken fuer neue Datei" : "Ablegen oder klicken"}
        </div>
        <input
          type="file"
          accept="application/pdf"
          onChange={onSelectFile}
          hidden
        />
      </div>

      <div className="field">
        <label className="field-label">Fach</label>
        <select
          value={selectedSubject}
          onChange={(e) => onSubjectChange(e.target.value)}
        >
          {subjects.length === 0 ? (
            <option value="">Keine Faecher</option>
          ) : (
            subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.title}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="field">
        <label className="field-label">Modell</label>
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

      <div className="field">
        <label className="field-label">Struktur (optional)</label>
        <textarea
          rows={2}
          placeholder="z.B. Einleitung, Begriffe"
          value={structureHints}
          onChange={(e) => onStructureChange(e.target.value)}
        />
      </div>

      {children}
    </div>
  );
}
