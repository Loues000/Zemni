import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { normalizePdfText } from "@/lib/normalize-pdf-text";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    text = parsed.text || "";
  } else {
    text = buffer.toString("utf8");
  }

  // Normalize text to improve quality and reduce tokens
  text = normalizePdfText(text);

  // Return only extracted text - token/cost estimation is handled by /api/token-estimate
  return NextResponse.json({ text });
}
