"use client";

import { createContext, useContext, ReactNode } from "react";
import { useToast } from "@/hooks";
import { ToastContainer } from "@/components/ui";

const ToastContext = createContext<ReturnType<typeof useToast> | null>(null);

/**
 * Provide toast state and rendering for settings pages.
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
 * Access the toast context within the provider tree.
 */
export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastContext must be used within ToastProvider");
  }
  return context;
}
