import { NextResponse } from "next/server";
import { validateEnvVars } from "@/lib/utils/env-validation";

/**
 * Health-check endpoint that reports application status and, optionally, environment-variable validation.
 *
 * If the query parameter `validate=true` is present, the response includes a `validation` object describing
 * whether required environment variables are present and any that are missing or invalid.
 *
 * @param request - Incoming HTTP request; supports the `validate` query parameter (`validate=true`) to enable validation.
 * @returns JSON object with:
 *  - `status`: service status string (e.g., `"ok"`),
 *  - `timestamp`: ISO 8601 timestamp string of the response,
 *  - `validation` (optional): object with `valid` (boolean), `missing` (string[]), and `invalid` (array of `{ name, reason }`).
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