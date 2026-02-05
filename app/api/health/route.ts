import { NextResponse } from "next/server";
import { validateEnvVars } from "@/lib/utils/env-validation";

/**
 * Health check endpoint
 * Returns application status for monitoring and load balancer health checks
 * 
 * GET /api/health
 * GET /api/health?validate=true
 * 
 * Response (default):
 * {
 *   "status": "ok",
 *   "timestamp": "2026-02-XXT..."
 * }
 * 
 * Response (with ?validate=true):
 * {
 *   "status": "ok",
 *   "timestamp": "2026-02-XXT...",
 *   "validation": {
 *     "valid": true,
 *     "missing": [],
 *     "invalid": []
 *   }
 * }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shouldValidate = searchParams.get("validate") === "true";

  const response: {
    status: string;
    timestamp: string;
    validation?: {
      valid: boolean;
      missing: string[];
      invalid: Array<{ name: string; reason: string }>;
    };
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  // Optionally validate environment variables
  if (shouldValidate) {
    const validation = validateEnvVars();
    response.validation = {
      valid: validation.valid,
      missing: validation.missing,
      invalid: validation.invalid,
    };
  }

  return NextResponse.json(response);
}
