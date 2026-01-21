import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { normalizePdfText } from "@/lib/normalize-pdf-text";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  let text = "";

  // Check if request contains JSON (client-side parsed text) or FormData (file upload fallback)
  if (contentType.includes("application/json")) {
    // Client-side parsing: text is already extracted
    const body = await request.json();
    text = String(body.text ?? "");
    
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
  } else {
    // Server-side parsing fallback (for compatibility or if client-side parsing fails)
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const parsed = await pdfParse(buffer);
      text = parsed.text || "";
    } else {
      text = buffer.toString("utf8");
    }
  }

  // Normalize text to improve quality and reduce tokens
  text = normalizePdfText(text);

  // Return only extracted text - token/cost estimation is handled by /api/token-estimate
  return NextResponse.json({ text });
}
