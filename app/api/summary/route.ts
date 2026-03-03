import { POST as postSectionSummary } from "@/app/api/section-summary/route";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return postSectionSummary(request);
}
