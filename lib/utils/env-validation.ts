/**
 * Environment variable validation utilities
 * Validates required and optional environment variables for production deployment
 */

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  invalid: Array<{ name: string; reason: string }>;
}

/**
 * Check whether a string is a hexadecimal string of an exact character length.
 *
 * @param value - The string to validate
 * @param length - The required number of characters in `value`
 * @returns `true` if `value` contains only hexadecimal characters and its length equals `length`, `false` otherwise
 */
function isValidHex(value: string, length: number): boolean {
  return /^[0-9a-f]+$/i.test(value) && value.length === length;
}

/**
 * Determines whether a string is a well-formed HTTP or HTTPS URL.
 *
 * @param value - The string to validate as a URL
 * @returns `true` if `value` is a valid URL with the `http:` or `https:` protocol, `false` otherwise
 */
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate required and optional environment variables and report any missing or incorrectly formatted entries.
 *
 * Performs presence checks for required variables and format checks for specific values (e.g., `ENCRYPTION_KEY` must be a 64-character hex string, URL-valued variables must be valid `http`/`https` URLs, Clerk keys must start with `pk_`/`sk_`, etc.). Optional variables are validated only when set.
 *
 * @returns An `EnvValidationResult` containing `valid` (true when no missing or invalid entries), `missing` (names of required variables that are unset or empty), and `invalid` (array of `{ name, reason }` objects describing variables that failed validation)
 */
export function validateEnvVars(): EnvValidationResult {
  const missing: string[] = [];
  const invalid: Array<{ name: string; reason: string }> = [];

  // Required variables
  const requiredVars = [
    {
      name: "ENCRYPTION_KEY",
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "ENCRYPTION_KEY is required";
        }
        if (!isValidHex(value, 64)) {
          return "ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)";
        }
        return null;
      },
    },
    {
      name: "NEXT_PUBLIC_CONVEX_URL",
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "NEXT_PUBLIC_CONVEX_URL is required";
        }
        if (!isValidUrl(value)) {
          return "NEXT_PUBLIC_CONVEX_URL must be a valid URL";
        }
        return null;
      },
    },
    {
      name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required";
        }
        if (!value.startsWith("pk_")) {
          return "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must start with 'pk_'";
        }
        return null;
      },
    },
    {
      name: "CLERK_SECRET_KEY",
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "CLERK_SECRET_KEY is required";
        }
        if (!value.startsWith("sk_")) {
          return "CLERK_SECRET_KEY must start with 'sk_'";
        }
        return null;
      },
    },
    {
      name: "OPENROUTER_API_KEY",
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "OPENROUTER_API_KEY is required";
        }
        return null;
      },
    },
  ];

  // Optional variables (validated if set)
  const optionalVars = [
    {
      name: "NEXT_PUBLIC_SENTRY_DSN",
      validate: (value: string) => {
        if (value && value.trim().length > 0 && !isValidUrl(value)) {
          return "NEXT_PUBLIC_SENTRY_DSN must be a valid URL if set";
        }
        return null;
      },
    },
    {
      name: "SENTRY_DSN",
      validate: (value: string) => {
        if (value && value.trim().length > 0 && !isValidUrl(value)) {
          return "SENTRY_DSN must be a valid URL if set";
        }
        return null;
      },
    },
  ];

  // Validate required variables
  for (const { name, validate } of requiredVars) {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
      missing.push(name);
    } else {
      const error = validate(value);
      if (error) {
        invalid.push({ name, reason: error });
      }
    }
  }

  // Validate optional variables (only if set)
  for (const { name, validate } of optionalVars) {
    const value = process.env[name];
    if (value && value.trim().length > 0) {
      const error = validate(value);
      if (error) {
        invalid.push({ name, reason: error });
      }
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

/**
 * Produce a human-readable report of environment variable validation results.
 *
 * @param result - The validation outcome containing `valid`, `missing`, and `invalid` fields.
 * @returns A string containing a success message when all variables are valid, otherwise a newline-separated report listing missing required variables and invalid variables with reasons.
 */
export function getValidationReport(result: EnvValidationResult): string {
  if (result.valid) {
    return "✓ All environment variables are valid";
  }

  const lines: string[] = [];
  
  if (result.missing.length > 0) {
    lines.push("Missing required variables:");
    result.missing.forEach((name) => {
      lines.push(`  - ${name}`);
    });
  }

  if (result.invalid.length > 0) {
    lines.push("Invalid variables:");
    result.invalid.forEach(({ name, reason }) => {
      lines.push(`  - ${name}: ${reason}`);
    });
  }

  return lines.join("\n");
}