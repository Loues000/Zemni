/**
 * Client-side PDF text extraction using pdfjs-dist
 * This allows parsing large PDFs without hitting Vercel's 4.5MB body size limit
 */

export type PdfPageText = {
  page: number;
  text: string;
};

const PDF_WORKER_SRC = "/api/pdf-worker";
let cachedWorkerPort: Worker | null = null;

const configurePdfWorker = async (
  pdfjsLib: typeof import("pdfjs-dist/legacy/build/pdf.mjs")
): Promise<void> => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  if (typeof Worker === "undefined") {
    return;
  }

  if (!cachedWorkerPort) {
    try {
      cachedWorkerPort = new Worker(PDF_WORKER_SRC, { type: "module" });
    } catch {
      cachedWorkerPort = null;
    }
  }

  pdfjsLib.GlobalWorkerOptions.workerPort = cachedWorkerPort;
};

export async function extractPagesFromPdf(file: File): Promise<PdfPageText[]> {
  try {
    // Dynamically import the legacy build to avoid ESM/worker interop issues in Next.js
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Reuse a same-origin worker instance so PDF.js never falls back to a CDN URL.
    await configurePdfWorker(pdfjsLib);

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      // Disable font face loading for better performance
      disableFontFace: true,
      // Use native text extraction
      useSystemFonts: false
    });
    
    const pdf = await loadingTask.promise;
    const pages: PdfPageText[] = [];

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items from the page, preserving spacing
      const pageText = textContent.items
        .map((item: any) => {
          // Handle text items with transform info for better spacing
          if (item.str) {
            return item.str;
          }
          return "";
        })
        .join(" ");

      pages.push({ page: pageNum, text: pageText.trim() });
    }

    return pages;
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pages = await extractPagesFromPdf(file);
  return pages.map((p) => p.text).join("\n\n").trim();
}
