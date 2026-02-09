#!/usr/bin/env node
/**
 * Environment variable validation script
 * Validates all required and optional environment variables
 * 
 * Usage:
 *   npm run validate-env
 *   or
 *   tsx scripts/validate-env.ts
 * 
 * Exit codes:
 *   0 - All variables valid
 *   1 - Missing or invalid variables
 */

import { validateEnvVars, getValidationReport } from "../lib/utils/env-validation";

function main() {
  console.log("Validating environment variables...\n");

  const result = validateEnvVars();
  const report = getValidationReport(result);

  console.log(report);

  if (!result.valid) {
    console.error("\n❌ Environment variable validation failed");
    console.error("Please fix the issues above before deploying to production.");
    process.exit(1);
  }

  console.log("\n✅ All environment variables are valid!");
  process.exit(0);
}

main();
