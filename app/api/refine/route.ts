 import { NextResponse } from "next/server";
import { StreamData, streamText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { buildRefineSystemPrompt } from "@/lib/prompts";
import { loadModels } from "@/lib/models";
import { buildUsageStats } from "@/lib/usage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "Missing OpenRouter key" }, { status: 400 });
  }

  const body = await request.json();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const summary = String(body.summary ?? "");
  const modelId = String(body.modelId ?? "");

  if (!summary || !modelId) {
    return NextResponse.json({ error: "Missing summary or model" }, { status: 400 });
  }

  const models = await loadModels();
  const model = models.find((item) => item.openrouterId === modelId) ?? null;
  const systemPrompt = await buildRefineSystemPrompt(summary);
  const data = new StreamData();
  const start = Date.now();
  const result = await streamText({
    model: openrouter(modelId) as any,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    onFinish: (event) => {
      const usage = buildUsageStats(event.usage, Date.now() - start, model, "refine");
      if (usage) {
        data.append({ type: "usage", payload: usage });
      }
      void data.close();
    }
  });

  return result.toDataStreamResponse({ data });
}
