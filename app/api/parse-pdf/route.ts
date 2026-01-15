import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { loadModels } from "@/lib/models";
import { buildCostRows, countTokensByEncoding } from "@/lib/token-cost";

export const runtime = "nodejs";

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

  const models = await loadModels();
  const encodings = models.map((model) => model.tokenizer);
  const tokensByEncoding = await countTokensByEncoding(text, encodings);
  const modelCosts = buildCostRows(models, tokensByEncoding, 0);

  return NextResponse.json({ text, modelCosts });
}
