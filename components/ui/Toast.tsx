"use client";

import { useEffect } from "react";
import { IconX } from "./Icons";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

/**
 * Renders a single toast notification with type-specific styling and a close control.
 *
 * Renders the toast's message, applies a CSS class based on `toast.type`, and calls `onClose(toast.id)` when the close button is clicked.
 * If `toast.duration` is a number greater than 0, automatically calls `onClose(toast.id)` after `toast.duration` milliseconds.
 *
 * @param toast - The toast data (id, message, type, and optional duration in milliseconds)
 * @param onClose - Callback invoked with the toast `id` when the toast is dismissed
 * @returns The rendered toast element
 */
export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onClose]);

  const typeStyles: Record<ToastType, string> = {
    success: "toast-success",
    error: "toast-error",
    info: "toast-info",
    warning: "toast-warning",
  };

  return (
    <div className={`toast ${typeStyles[toast.type]}`} role="alert">
      <div className="toast-content">
        <span className="toast-message">{toast.message}</span>
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => onClose(toast.id)}
        aria-label="Close notification"
      >
        <IconX />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

/**
 * Renders a live-region container for a list of toast notifications.
 *
 * @param toasts - Array of toast objects to render inside the container
 * @param onClose - Callback invoked with a toast `id` when that toast requests to close
 * @returns The container element with rendered toasts, or `null` when `toasts` is empty
 */
export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}