import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { normalizePdfText } from "@/lib/normalize-pdf-text";
import { validateTextSize, validatePdfSize, validatePagesSize } from "@/lib/request-validation";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Extracts and normalizes text from a POST Request supporting JSON payloads with `text` or `pages`, or file uploads via FormData, and returns the normalized text and optional page array.
 *
 * Validates text, PDF, and pages sizes and responds with HTTP 400 for missing inputs or HTTP 413 when a size validation fails.
 *
 * @returns A JSON object containing `text`, and `pages` when the request provided page-level input.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  let text = "";
  let pages: string[] | null = null;

  // Check if request contains JSON (client-side parsed text) or FormData (file upload fallback)
  if (contentType.includes("application/json")) {
    // Client-side parsing: text is already extracted
    const body = await request.json();

    if (Array.isArray(body.pages)) {
      const rawPages: string[] = body.pages
        .map((p: unknown) => String(p ?? ""))
        .filter((p: string) => p.trim().length > 0);
      if (rawPages.length === 0) {
        return NextResponse.json({ error: "Missing pages" }, { status: 400 });
      }
      
      // Validate total size of pages
      const pagesValidation = validatePagesSize(rawPages);
      if (!pagesValidation.valid) {
        return NextResponse.json({ error: pagesValidation.error }, { status: 413 });
      }
      
      pages = rawPages.map((p: string) => normalizePdfText(p));
      text = normalizePdfText(rawPages.join("\n\n"));
    } else {
      text = String(body.text ?? "");
      if (!text) {
        return NextResponse.json({ error: "Missing text" }, { status: 400 });
      }
      
      // Validate text size
      const textValidation = validateTextSize(text);
      if (!textValidation.valid) {
        return NextResponse.json({ error: textValidation.error }, { status: 413 });
      }
      
      text = normalizePdfText(text);
    }
  } else {
    // Server-side parsing fallback (for compatibility or if client-side parsing fails)
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Validate file size before parsing
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfValidation = validatePdfSize(buffer);
      if (!pdfValidation.valid) {
        return NextResponse.json({ error: pdfValidation.error }, { status: 413 });
      }
    } else {
      // For non-PDF files, validate as text (1MB limit)
      const textValidation = validateTextSize(buffer.toString("utf8"));
      if (!textValidation.valid) {
        return NextResponse.json({ error: textValidation.error }, { status: 413 });
      }
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const parsed = await pdfParse(buffer);
      text = parsed.text || "";
    } else {
      text = buffer.toString("utf8");
    }

    // Normalize text to improve quality and reduce tokens
    text = normalizePdfText(text);
  }

  // Return only extracted text - token/cost estimation is handled by /api/token-estimate
  return NextResponse.json(pages ? { text, pages } : { text });
}