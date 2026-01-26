import type { Status } from "@/types";

export interface FileHandlersContext {
  setError: (error: string) => void;
  setStatus: (status: Status) => void;
  setMobileView: (view: "input" | "output") => void;
  setFileName: (name: string) => void;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setSelectedTabId: (id: string | null) => void;
  setSecondTabId: (id: string | null) => void;
  setGeneratingTabId: (id: string | null) => void;
  setLoadedFromHistory: (loaded: boolean) => void;
  setCurrentHistoryId: (id: string | null) => void;
  setMessages: (messages: any[]) => void;
  setInput: (input: string) => void;
  setData: (data: any[]) => void;
  setIsEditing: (editing: boolean) => void;
  setIsEditingSecond: (editing: boolean) => void;
  setLastExportedPageId: (id: string | null) => void;
  setExportProgress: (progress: { current: number; total: number } | null) => void;
  refineTargetRef: React.MutableRefObject<string>;
  setExtractedText: (text: string) => void;
}

/**
 * Handles file upload and parsing (PDF or Markdown)
 */
export const handleFile = async (
  file: File,
  context: FileHandlersContext
): Promise<void> => {
  const {
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
  } = context;

  setError("");
  
  const largeFileThreshold = 50 * 1024 * 1024;
  if (file.size > largeFileThreshold) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    console.warn(`Large file detected (${fileSizeMB} MB). Parsing may take a bit longer.`);
  }
  
  setStatus("parsing");
  setMobileView("input");
  setFileName(file.name);
  setOutputs({});
  setSelectedTabId(null);
  setSecondTabId(null);
  setGeneratingTabId(null);
  setLoadedFromHistory(false);
  setCurrentHistoryId(null);
  setMessages([]);
  setInput("");
  setData([]);
  setIsEditing(false);
  setIsEditingSecond(false);
  setLastExportedPageId(null);
  setExportProgress(null);
  refineTargetRef.current = "";
  
  try {
    let extractedText = "";
    let normalizedText: string | null = null;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const { extractTextFromPdf } = await import("@/lib/parse-pdf-client.ts");
        extractedText = await extractTextFromPdf(file);
      } catch (parseError) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData
        });
        if (!res.ok) {
          const clientMessage = parseError instanceof Error ? parseError.message : "Unknown error";
          throw new Error(`Client parsing failed. Server fallback failed. (${clientMessage})`);
        }
        const data = await res.json() as { text: string };
        normalizedText = data.text ?? "";
      }
    } else if (file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")) {
      extractedText = await file.text();
      normalizedText = extractedText;
    } else {
      extractedText = await file.text();
    }

    if (normalizedText === null) {
      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractedText })
      });

      if (!res.ok) throw new Error("Could not normalize text.");

      const data = await res.json() as { text: string };
      normalizedText = data.text ?? "";
    }

    setExtractedText(normalizedText);
    setStatus("ready");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
    setStatus("error");
  }
};

/**
 * Handles drag and drop file upload
 */
export const onDrop = (
  event: React.DragEvent<HTMLDivElement>,
  context: FileHandlersContext & { setDragActive: (active: boolean) => void }
): void => {
  event.preventDefault();
  context.setDragActive(false);
  const file = event.dataTransfer.files?.[0];
  if (file) handleFile(file, context);
};

/**
 * Handles drag over event
 */
export const onDragOver = (
  event: React.DragEvent<HTMLDivElement>,
  setDragActive: (active: boolean) => void
): void => {
  event.preventDefault();
  setDragActive(true);
};

/**
 * Handles drag leave event
 */
export const onDragLeave = (setDragActive: (active: boolean) => void): void => {
  setDragActive(false);
};

/**
 * Handles file input selection
 */
export const onSelectFile = (
  event: React.ChangeEvent<HTMLInputElement>,
  context: FileHandlersContext
): void => {
  const file = event.target.files?.[0];
  if (file) handleFile(file, context);
};
