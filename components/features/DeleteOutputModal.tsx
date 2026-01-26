"use client";

import { useEffect } from "react";

type DeleteOutputModalProps = {
  isOpen: boolean;
  outputLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteOutputModal({ isOpen, outputLabel, onCancel, onConfirm }: DeleteOutputModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Delete output">
      <button type="button" className="confirm-backdrop" onClick={onCancel} aria-label="Close delete dialog" />
      <div className="confirm-modal">
        <div className="confirm-title">Delete output?</div>
        <div className="confirm-body">
          You're about to delete <strong>{outputLabel}</strong>. This can't be undone.
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

