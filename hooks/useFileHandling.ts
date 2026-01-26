import { useState, useRef } from "react";
import type { Status } from "@/types";
import { handleFile as handleFileHandler, onDrop, onDragOver, onDragLeave, onSelectFile } from "@/lib/handlers/file-handlers";
import type { FileHandlersContext } from "@/lib/handlers/file-handlers";

export interface UseFileHandlingReturn {
  fileName: string;
  setFileName: React.Dispatch<React.SetStateAction<string>>;
  extractedText: string;
  setExtractedText: React.Dispatch<React.SetStateAction<string>>;
  dragActive: boolean;
  setDragActive: (active: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFile: (file: File) => Promise<void>;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onSelectFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Manages file upload, parsing, and drag-and-drop handlers
 */
export function useFileHandling(
  setStatus: (status: Status) => void,
  setError: (error: string) => void,
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  setSelectedTabId: (id: string | null) => void,
  setSecondTabId: (id: string | null) => void,
  setGeneratingTabId: (id: string | null) => void,
  setLoadedFromHistory: (loaded: boolean) => void,
  setCurrentHistoryId: (id: string | null) => void,
  setMessages: (messages: any[]) => void,
  setInput: (input: string) => void,
  setData: (data: any[]) => void,
  setIsEditing: (editing: boolean) => void,
  setIsEditingSecond: (editing: boolean) => void,
  setLastExportedPageId: (id: string | null) => void,
  setExportProgress: (progress: { current: number; total: number } | null) => void,
  refineTargetRef: React.MutableRefObject<string>,
  setMobileView: (view: "input" | "output") => void
): UseFileHandlingReturn {
  const [fileName, setFileName] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const context: FileHandlersContext = {
    setError,
    setStatus,
    setMobileView,
    setFileName,
    setOutputs,
    setSelectedTabId,
    setSecondTabId,
    setGeneratingTabId,
    setLoadedFromHistory,
    setCurrentHistoryId,
    setMessages,
    setInput,
    setData,
    setIsEditing,
    setIsEditingSecond,
    setLastExportedPageId,
    setExportProgress,
    refineTargetRef,
    setExtractedText
  };

  return {
    fileName,
    setFileName,
    extractedText,
    setExtractedText,
    dragActive,
    setDragActive,
    fileInputRef,
    handleFile: (file: File) => handleFileHandler(file, context),
    onDrop: (event: React.DragEvent<HTMLDivElement>) => onDrop(event, { ...context, setDragActive }),
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => onDragOver(event, setDragActive),
    onDragLeave: () => onDragLeave(setDragActive),
    onSelectFile: (event: React.ChangeEvent<HTMLInputElement>) => onSelectFile(event, context)
  };
}
