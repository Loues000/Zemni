"use client";

import { useEffect, useRef, useState } from "react";
import { IconClose } from "../ui/Icons";
import { ModelSelector } from "@/components/ui";
import type { Model } from "@/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  selectedModel: string;
  defaultModel: string;
  structureHints: string;
  defaultStructureHints: string;
  onSave: (settings: { defaultModel: string; defaultStructureHints: string }) => void;
  onExportZip?: () => void;
  historyCount?: number;
}

/**
 * Renders a settings modal that lets the user view and update the default model and default structure hints.
 *
 * The modal syncs its local inputs from the provided defaults when opened, closes when clicking outside
 * the dialog or pressing Escape, and persists changes via `onSave`.
 *
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback to close the modal
 * @param models - Available model options for selection
 * @param selectedModel - Currently active model (used as fallback when no local default is set)
 * @param defaultModel - Initial default model value used to populate the modal when opened
 * @param structureHints - Current structure hints (not directly edited by this modal)
 * @param defaultStructureHints - Initial default structure hints used to populate the modal when opened
 * @param onSave - Callback invoked with `{ defaultModel, defaultStructureHints }` to persist changes
 * @param onExportZip - Optional callback to export history as a ZIP archive
 * @param historyCount - Number of history entries; export option is shown only when this is greater than zero
 * @returns The modal element when open, or `null` when closed
 */
export function SettingsModal({
  isOpen,
  onClose,
  models,
  selectedModel,
  defaultModel,
  structureHints,
  defaultStructureHints,
  onSave,
  onExportZip,
  historyCount = 0
}: SettingsModalProps) {
  const [localDefaultModel, setLocalDefaultModel] = useState(defaultModel);
  const [localDefaultStructureHints, setLocalDefaultStructureHints] = useState(defaultStructureHints);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalDefaultModel(defaultModel);
    setLocalDefaultStructureHints(defaultStructureHints);
  }, [isOpen, defaultModel, defaultStructureHints]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        onClose();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSave = () => {
    onSave({
      defaultModel: localDefaultModel,
      defaultStructureHints: localDefaultStructureHints
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" />
      <div className="modal" ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header">
          <h2 id="settings-title">Settings</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <IconClose />
          </button>
        </div>
        <div className="modal-content">
          <div className="field">
            <label className="field-label" htmlFor="default-model">
              Default Model
            </label>
            <ModelSelector
              id="default-model"
              models={models}
              selectedModel={localDefaultModel || selectedModel}
              onModelChange={setLocalDefaultModel}
            />
            <p className="field-hint">This model will be selected by default when you start the app.</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="default-structure-hints">
              Default Structure Hints
            </label>
            <textarea
              id="default-structure-hints"
              className="field-input"
              rows={4}
              value={localDefaultStructureHints}
              onChange={(e) => setLocalDefaultStructureHints(e.target.value)}
              placeholder="e.g., Focus on key definitions, examples, and practical applications..."
            />
            <p className="field-hint">These hints will be pre-filled in the structure hints field for summaries.</p>
          </div>

          {onExportZip && historyCount > 0 && (
            <div className="field">
              <label className="field-label">Export</label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onExportZip}
              >
                Export History as ZIP
              </button>
              <p className="field-hint">Export all history entries as a ZIP archive containing various formats.</p>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}