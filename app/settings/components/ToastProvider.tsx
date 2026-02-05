"use client";

import { createContext, useContext, ReactNode } from "react";
import { useToast } from "@/hooks";
import { ToastContainer } from "@/components/ui";

const ToastContext = createContext<ReturnType<typeof useToast> | null>(null);

/**
 * Provides toast state and actions to descendant components and mounts a ToastContainer.
 *
 * @param children - The React nodes that will have access to the toast context
 * @returns A React element that supplies the toast context to its children and renders a ToastContainer for displaying toasts
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * Access the toast context provided by ToastProvider.
 *
 * @returns The toast context value (the object returned by `useToast`).
 * @throws Error if called outside a `ToastProvider` (message: "useToastContext must be used within ToastProvider").
 */
export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastContext must be used within ToastProvider");
  }
  return context;
}