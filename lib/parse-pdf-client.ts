/**
 * Client-side PDF text extraction using pdfjs-dist
 * This allows parsing large PDFs without hitting Vercel's 4.5MB body size limit
 */

export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    // Dynamically import pdfjs-dist to avoid SSR issues
    const pdfjsLib = await import("pdfjs-dist");
    
    // Set worker source for pdfjs (use CDN for worker)
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
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
