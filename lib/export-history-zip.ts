import type { HistoryEntry, OutputEntry } from "@/types";
import { flashcardsToMarkdown, renderQuizPreview } from "./output-previews";
import { flashcardsToTsv, quizToMarkdown } from "./exporters";

/**
 * Exports history entries as a ZIP file
 * Note: This requires JSZip library. Install with: npm install jszip
 */
export async function exportHistoryAsZip(history: HistoryEntry[]): Promise<void> {
  // Dynamic import to avoid bundle size if not used
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const entry of history) {
    const entryFolder = zip.folder(entry.fileName.replace(/[^a-z0-9]/gi, "_") || "document");
    if (!entryFolder) continue;

    // Add metadata
    entryFolder.file("metadata.json", JSON.stringify({
      title: entry.title,
      fileName: entry.fileName,
      createdAt: new Date(entry.createdAt).toISOString(),
      updatedAt: new Date(entry.updatedAt).toISOString(),
      folder: entry.folder ?? null,
      exportedSubject: entry.exportedSubject,
      notionPageId: entry.notionPageId,
    }, null, 2));

    // Add each output
    for (const [outputId, output] of Object.entries(entry.outputs)) {
      const outputFolder = entryFolder.folder(`output-${outputId.slice(0, 8)}`);
      if (!outputFolder) continue;

      if (output.kind === "summary") {
        outputFolder.file("summary.md", output.summary || "");
        if (output.usage) {
          outputFolder.file("usage.json", JSON.stringify(output.usage, null, 2));
        }
      } else if (output.kind === "flashcards" && output.flashcards) {
        const markdown = flashcardsToMarkdown(output.flashcards, entry.fileName);
        const tsv = flashcardsToTsv(output.flashcards, entry.fileName);
        outputFolder.file("flashcards.md", markdown);
        outputFolder.file("flashcards.tsv", tsv.content);
        if (output.usage) {
          outputFolder.file("usage.json", JSON.stringify(output.usage, null, 2));
        }
      } else if (output.kind === "quiz" && output.quiz) {
        const markdown = quizToMarkdown(output.quiz, entry.fileName);
        outputFolder.file("quiz.md", markdown.content);
        outputFolder.file("quiz.json", JSON.stringify({ questions: output.quiz }, null, 2));
        if (output.usage) {
          outputFolder.file("usage.json", JSON.stringify(output.usage, null, 2));
        }
      }
    }
  }

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `zemni-history-${new Date().toISOString().split("T")[0]}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
