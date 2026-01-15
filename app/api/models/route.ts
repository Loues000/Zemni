import { NextResponse } from "next/server";
import { loadModels } from "@/lib/models";

export const runtime = "nodejs";

export async function GET() {
  const models = await loadModels();
  return NextResponse.json({
    models: models.map((model) => ({
      id: model.openrouterId,
      name: model.name,
      provider: model.provider,
      displayName: model.displayName || `${model.provider}/${model.name}`,
      tokenizer: model.tokenizer,
      pricing: model.pricing
    }))
  });
}
