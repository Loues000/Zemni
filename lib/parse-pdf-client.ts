/**
 * Client-side PDF text extraction using pdfjs-dist
 * This allows parsing large PDFs without hitting Vercel's 4.5MB body size limit
 */

export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    // Dynamically import the legacy build to avoid ESM/worker interop issues in Next.js
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Resolve worker from local package via import.meta.url (avoids CORS/ESM fetch issues)
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const workerUrl = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      // Disable font face loading for better performance
      disableFontFace: true,
      // Use native text extraction
      useSystemFonts: false
    });
    
    const pdf = await loadingTask.promise;
    
    let fullText = "";

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
      
      fullText += pageText + "\n\n";
    }

    return fullText.trim();
  } catch (error) {
    throw new Error(`PDF-Parsing fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
  }
}
