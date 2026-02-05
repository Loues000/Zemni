"use client";

import { useEffect } from "react";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Render a confirmation modal dialog with a title, message, and cancel/confirm actions.
 *
 * @param isOpen - Whether the modal is visible
 * @param title - Title text shown in the dialog's header
 * @param message - Body text shown in the dialog
 * @param confirmLabel - Label for the confirm button (defaults to "Confirm")
 * @param cancelLabel - Label for the cancel button (defaults to "Cancel")
 * @param variant - Visual variant of the confirm button; `"danger"` renders a danger-style button, otherwise the default primary style
 * @param onCancel - Callback invoked when the dialog is dismissed (backdrop click, Escape key, or cancel button)
 * @param onConfirm - Callback invoked when the confirm button is clicked
 * @returns The modal element when `isOpen` is true, or `null` when `isOpen` is false
 */
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
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
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="confirm-backdrop"
        onClick={onCancel}
        aria-label="Close dialog"
      />
      <div className="confirm-modal">
        <div className="confirm-title">{title}</div>
        <div className="confirm-body">{message}</div>
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}