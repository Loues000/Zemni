import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

let cachedWorkerSource: string | null = null;

export async function GET() {
  try {
    if (!cachedWorkerSource) {
      const workerPath = path.join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
        "legacy",
        "build",
        "pdf.worker.min.mjs"
      );
      cachedWorkerSource = await readFile(workerPath, "utf8");
    }

    return new NextResponse(cachedWorkerSource, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to load PDF.js worker source", error);
    return NextResponse.json(
      { error: "Unable to load PDF worker" },
      { status: 500 }
    );
  }
}
