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
 * Validate that a string is a valid hexadecimal string of exact length
 */
function isValidHex(value: string, length: number): boolean {
  return /^[0-9a-f]+$/i.test(value) && value.length === length;
}

/**
 * Validate that a string is a valid URL
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
 * Validate all required and optional environment variables
 * Returns validation result with missing and invalid variables
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
 * Get a human-readable validation report
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
