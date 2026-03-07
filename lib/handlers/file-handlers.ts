import type { Status } from "@/types";
import { normalizePdfText } from "@/lib/normalize-pdf-text";

const CLIENT_PARSE_TIMEOUT_MS_MOBILE = 12_000;
const CLIENT_PARSE_TIMEOUT_MS_DESKTOP = 30_000;
const PARSE_API_TIMEOUT_MS = 30_000;
// Keep comfortably below typical serverless request body limits to avoid platform-level 413s.
const SERVER_PDF_PARSE_MAX_BYTES = 4 * 1024 * 1024;

const isCoarsePointerDevice = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Parsing request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getParseApiErrorMessage = async (res: Response): Promise<string> => {
  try {
    const payload = await res.json() as { error?: string };
    if (payload?.error) return payload.error;
  } catch {
    // Ignore body parse errors and use status fallback
  }
  return `Request failed with status ${res.status}.`;
};

const parsePdfOnServer = async (file: File): Promise<string> => {
  if (file.size > SERVER_PDF_PARSE_MAX_BYTES) {
    const maxMb = (SERVER_PDF_PARSE_MAX_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(`PDF exceeds the ${maxMb}MB server upload limit.`);
  }
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithTimeout(
    "/api/parse-pdf",
    {
      method: "POST",
      body: formData
    },
    PARSE_API_TIMEOUT_MS
  );
  if (!res.ok) {
    throw new Error(await getParseApiErrorMessage(res));
  }
  const data = await res.json() as { text: string };
  return data.text ?? "";
};

const parsePdfOnClient = async (file: File): Promise<string> => {
  const { extractTextFromPdf } = await import("@/lib/parse-pdf-client.ts");
  const clientParseTimeoutMs = isCoarsePointerDevice()
    ? CLIENT_PARSE_TIMEOUT_MS_MOBILE
    : CLIENT_PARSE_TIMEOUT_MS_DESKTOP;
  return withTimeout(
    extractTextFromPdf(file),
    clientParseTimeoutMs,
    "Client PDF parsing timed out."
  );
};

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
    const isPdfFile = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const serverPdfFallbackAvailable = file.size <= SERVER_PDF_PARSE_MAX_BYTES;
    const serverPdfFallbackLimitMb = (SERVER_PDF_PARSE_MAX_BYTES / (1024 * 1024)).toFixed(0);

    if (isPdfFile) {
      const preferServerFirst = isCoarsePointerDevice() && serverPdfFallbackAvailable;
      if (preferServerFirst) {
        try {
          normalizedText = await parsePdfOnServer(file);
        } catch (serverFirstError) {
          try {
            extractedText = await parsePdfOnClient(file);
          } catch (clientError) {
            const serverMessage = serverFirstError instanceof Error ? serverFirstError.message : "Unknown server parse error";
            const clientMessage = clientError instanceof Error ? clientError.message : "Unknown client parse error";
            throw new Error(`Server-first parsing failed (${serverMessage}). Client fallback failed (${clientMessage}).`);
          }
        }
      } else {
        try {
          extractedText = await parsePdfOnClient(file);
        } catch (parseError) {
          if (!serverPdfFallbackAvailable) {
            const clientMessage = parseError instanceof Error ? parseError.message : "Unknown client parse error";
            throw new Error(
              `Client parsing failed (${clientMessage}). Server fallback unavailable because PDFs over ${serverPdfFallbackLimitMb}MB exceed the upload limit.`
            );
          }
          try {
            normalizedText = await parsePdfOnServer(file);
          } catch (fallbackError) {
            const clientMessage = parseError instanceof Error ? parseError.message : "Unknown client parse error";
            const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "Unknown server fallback error";
            throw new Error(`Client parsing failed (${clientMessage}). Server fallback failed (${fallbackMessage}).`);
          }
        }
      }
    } else if (file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")) {
      extractedText = await file.text();
      normalizedText = extractedText;
    } else {
      extractedText = await file.text();
    }

    if (normalizedText === null) {
      normalizedText = normalizePdfText(extractedText);
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
