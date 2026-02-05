import { useState, useCallback } from "react";
import type { Toast, ToastType } from "@/components/ui/Toast";

/**
 * Manages toast notifications and exposes functions to add, remove, and create typed toasts.
 *
 * @returns An object with:
 * - `toasts`: the current array of `Toast` objects.
 * - `showToast(message, type?, duration?)`: adds a toast with the given message, type (`ToastType`, default `"info"`), and duration (milliseconds, default `5000`); returns the generated toast id.
 * - `removeToast(id)`: removes the toast with the specified id.
 * - `success(message, duration?)`, `error(message, duration?)`, `info(message, duration?)`, `warning(message, duration?)`: convenience helpers that add a toast with the corresponding type and return the generated toast id.
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 5000) => {
      const id = crypto.randomUUID();
      const newToast: Toast = {
        id,
        message,
        type,
        duration,
      };
      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, "success", duration),
    [showToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => showToast(message, "error", duration),
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => showToast(message, "info", duration),
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, "warning", duration),
    [showToast]
  );

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };
}