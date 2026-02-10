import type { HistoryEntry, OutputEntry } from "@/types";
import { getSummaryTitle, getFlashcardsTitle, getQuizTitle, createPdfId } from "@/lib/output-previews";
import { getDocumentTitle } from "@/lib/document-title";

export interface SaveToHistoryParams {
    outputs: Record<string, OutputEntry>;
    extractedText: string;
    fileName: string;
    structureHints: string;
    currentHistoryId: string | null;
    updateHistoryState: (updater: (prev: HistoryEntry[]) => HistoryEntry[]) => void;
    exportedSubjectTitle?: string;
    notionPageId?: string;
    folder?: string;
    setCurrentHistoryId?: (id: string | null) => void;
}

/**
 * Common logic to save a document and its outputs to history.
 * Handles deduplication by content/filename and merging of outputs.
 */
export const saveToHistoryInternal = ({
    outputs,
    extractedText,
    fileName,
    structureHints,
    currentHistoryId,
    updateHistoryState,
    exportedSubjectTitle,
    notionPageId,
    folder,
    setCurrentHistoryId
}: SaveToHistoryParams): void => {
    if (!extractedText || Object.keys(outputs).length === 0) return;

    const derivedTitle = getDocumentTitle(extractedText, fileName);
    
    // Generate title based on available outputs (summary > flashcards > quiz > fallback)
    let title = derivedTitle;
    const summaryTab = Object.values(outputs).find(
        (o) => (o.kind ?? "summary") === "summary" && (o.summary ?? "").trim().length > 0
    );
    if (summaryTab) {
        title = getSummaryTitle(summaryTab.summary ?? "", derivedTitle);
    } else {
        const flashcardsTab = Object.values(outputs).find(
            (o) => o.kind === "flashcards" && (o.flashcards ?? []).length > 0
        );
        if (flashcardsTab) {
            title = getFlashcardsTitle(flashcardsTab.flashcards ?? [], fileName, derivedTitle);
        } else {
            const quizTab = Object.values(outputs).find(
                (o) => o.kind === "quiz" && (o.quiz ?? []).length > 0
            );
            if (quizTab) {
                title = getQuizTitle(quizTab.quiz ?? [], fileName, derivedTitle);
            }
        }
    }
    const pdfId = createPdfId(fileName || "untitled", extractedText);
    const now = Date.now();

    updateHistoryState((prev) => {
        const existingEntry = prev.find((h) => {
            const hPdfId = createPdfId(h.fileName, h.extractedText);
            return hPdfId === pdfId;
        });

        // Use existing entry ID if found, otherwise use currentHistoryId or generate new pdfId
        const historyId = existingEntry?.id || currentHistoryId || pdfId;

        // Merge outputs: combine existing outputs with new outputs (new outputs take precedence for same tab IDs)
        const mergedOutputs = existingEntry
            ? { ...existingEntry.outputs, ...outputs }
            : outputs;

        let finalExportedSubject: string | undefined;
        if (exportedSubjectTitle !== undefined) {
            finalExportedSubject = exportedSubjectTitle || undefined;
        } else {
            finalExportedSubject = existingEntry?.exportedSubject;
        }

        const entry: HistoryEntry = {
            id: historyId,
            title,
            fileName,
            extractedText,
            outputs: mergedOutputs,
            structureHints,
            createdAt: existingEntry?.createdAt || now,
            updatedAt: now,
            folder: folder ?? existingEntry?.folder ?? null,
            exportedSubject: finalExportedSubject,
            notionPageId: notionPageId || existingEntry?.notionPageId
        };

        const filtered = prev.filter((item) => {
            if (item.id === entry.id) return false;
            if (existingEntry && item.id === existingEntry.id) return false;
            return true;
        });

        // Set currentHistoryId if not already set
        if (setCurrentHistoryId && !currentHistoryId) {
            setCurrentHistoryId(historyId);
        }

        return [entry, ...filtered];
    });
};
