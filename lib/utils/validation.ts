/**
 * Comprehensive input validation utilities
 * Provides validation for text length, structure hints, model IDs, and file types
 */

import { loadModels } from "@/lib/models";

// Validation limits
const MAX_TEXT_LENGTH = 1_000_000; // 1M characters (beyond size limits)
const MAX_STRUCTURE_HINTS_LENGTH = 10_000; // 10K characters for structure hints
const MAX_MESSAGES_ARRAY_LENGTH = 100; // Maximum number of messages in refine endpoint

/**
 * Validate that a text's character count does not exceed a maximum.
 *
 * @param text - The text to validate
 * @param maxLength - Maximum allowed number of characters (defaults to MAX_TEXT_LENGTH)
 * @returns `{ valid: true }` if `text.length` is less than or equal to `maxLength`, `{ valid: false, error }` otherwise. `error` reports current and maximum lengths in thousands of characters.
 */
export function validateTextLength(text: string, maxLength: number = MAX_TEXT_LENGTH): { valid: boolean; error?: string } {
  if (text.length > maxLength) {
    const lengthK = Math.floor(text.length / 1000);
    const maxK = Math.floor(maxLength / 1000);
    return {
      valid: false,
      error: `Text exceeds maximum length of ${maxK}K characters (current: ${lengthK}K characters)`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate that structure hints are plain text within the allowed length and do not contain simple suspicious patterns.
 *
 * Accepts empty or whitespace-only input (optional field) and allows plain headings; rejects inputs that exceed the maximum configured length or match basic malicious patterns such as `<script>`, `javascript:` URIs, or inline event handlers.
 *
 * @param structureHints - The structure hints text to validate; may be empty or contain plain headings.
 * @returns `{ valid: true }` if the input is acceptable; otherwise `{ valid: false, error }` with a concise error message describing the failure.
 */
export function validateStructureHints(structureHints: string): { valid: boolean; error?: string } {
  if (!structureHints || structureHints.trim().length === 0) {
    return { valid: true }; // Empty is valid (optional field)
  }

  // Check length
  if (structureHints.length > MAX_STRUCTURE_HINTS_LENGTH) {
    const lengthK = Math.floor(structureHints.length / 1000);
    const maxK = Math.floor(MAX_STRUCTURE_HINTS_LENGTH / 1000);
    return {
      valid: false,
      error: `Structure hints exceed maximum length of ${maxK}K characters (current: ${lengthK}K characters)`,
    };
  }

  // Check for potentially malicious content (basic check)
  // Reject if contains script tags or suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(structureHints)) {
      return {
        valid: false,
        error: "Structure hints contain invalid content",
      };
    }
  }

  return { valid: true };
}

/**
 * Check that a model ID corresponds to an available model.
 *
 * @param modelId - The model's OpenRouter identifier (`openrouterId`)
 * @returns An object with `valid: true` when a model with the given ID exists; otherwise `valid: false` and an `error` message describing the problem.
 */
export async function validateModelId(modelId: string): Promise<{ valid: boolean; error?: string }> {
  if (!modelId || typeof modelId !== "string" || modelId.trim().length === 0) {
    return {
      valid: false,
      error: "Model ID is required",
    };
  }

  try {
    const models = await loadModels();
    const model = models.find((m) => m.openrouterId === modelId);
    
    if (!model) {
      return {
        valid: false,
        error: `Model "${modelId}" not found in available models`,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Failed to load models for validation:", error);
    // Fail open - allow request if model loading fails
    return { valid: true };
  }
}

/**
 * Validate that a filename (and optional MIME type) corresponds to an allowed file type (PDF or Markdown).
 *
 * @param fileName - The uploaded file's name; required for extension-based detection
 * @param mimeType - Optional MIME type to assist detection when provided
 * @returns `{ valid: true }` if the file is a PDF or Markdown file, ` { valid: false, error }` otherwise; the `error` explains the failure (missing file name or unsupported type)
 */
export function validateFileType(fileName: string, mimeType?: string): { valid: boolean; error?: string } {
  if (!fileName) {
    return {
      valid: false,
      error: "File name is required",
    };
  }

  const lowerFileName = fileName.toLowerCase();
  const isPdf = lowerFileName.endsWith(".pdf") || mimeType === "application/pdf";
  const isMarkdown = lowerFileName.endsWith(".md") || 
                     lowerFileName.endsWith(".markdown") || 
                     mimeType === "text/markdown" ||
                     mimeType === "text/x-markdown";

  if (!isPdf && !isMarkdown) {
    return {
      valid: false,
      error: `Invalid file type. Only PDF (.pdf) and Markdown (.md, .markdown) files are supported. Got: ${fileName}`,
    };
  }

  return { valid: true };
}

/**
 * Validate an array of message objects intended for the refine endpoint.
 *
 * @param messages - The messages array to validate; each item must be an object with string `role` and `content` fields.
 * @returns `{ valid: true }` if all messages conform; otherwise `{ valid: false, error }` describing the first validation failure.
 */
export function validateMessagesArray(messages: unknown[]): { valid: boolean; error?: string } {
  if (!Array.isArray(messages)) {
    return {
      valid: false,
      error: "Messages must be an array",
    };
  }

  if (messages.length > MAX_MESSAGES_ARRAY_LENGTH) {
    return {
      valid: false,
      error: `Messages array exceeds maximum length of ${MAX_MESSAGES_ARRAY_LENGTH} messages (current: ${messages.length})`,
    };
  }

  // Validate each message has required fields
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") {
      return {
        valid: false,
        error: `Message at index ${i} must be an object`,
      };
    }

    const msgObj = msg as Record<string, unknown>;
    if (typeof msgObj.role !== "string" || typeof msgObj.content !== "string") {
      return {
        valid: false,
        error: `Message at index ${i} must have "role" and "content" string fields`,
      };
    }

    // Validate role is valid
    const validRoles = ["user", "assistant", "system"];
    if (!validRoles.includes(msgObj.role)) {
      return {
        valid: false,
        error: `Message at index ${i} has invalid role "${msgObj.role}". Must be one of: ${validRoles.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate summary text for the refine endpoint.
 *
 * Ensures `summary` is a non-empty string and does not exceed the configured maximum text length.
 *
 * @param summary - The summary text to validate.
 * @returns An object with `valid: true` when `summary` passes validation; when invalid `error` contains a descriptive message.
 */
export function validateSummaryText(summary: string): { valid: boolean; error?: string } {
  if (!summary || typeof summary !== "string") {
    return {
      valid: false,
      error: "Summary must be a non-empty string",
    };
  }

  // Use same length limit as text validation
  return validateTextLength(summary, MAX_TEXT_LENGTH);
}

/**
 * Validate that the flashcards density is an integer from 1 (lowest) to 5 (highest).
 *
 * @param density - Desired flashcards density level; expected to be an integer in the range 1..5
 * @returns An object of the form `{ valid: true }` when the value is valid; otherwise `{ valid: false, error: string }` with a human-readable error message
 */
export function validateFlashcardsDensity(density: unknown): { valid: boolean; error?: string } {
  if (typeof density !== "number") {
    return {
      valid: false,
      error: "Flashcards density must be a number",
    };
  }

  if (density < 1 || density > 5 || !Number.isInteger(density)) {
    return {
      valid: false,
      error: "Flashcards density must be an integer between 1 and 5",
    };
  }

  return { valid: true };
}

/**
 * Validate that a quiz questions count is an integer between 1 and the allowed maximum.
 *
 * @param count - The number of questions to validate
 * @param maxCount - The maximum allowed questions (default: 50)
 * @returns `{ valid: true }` if `count` is an integer between 1 and `maxCount`, `{ valid: false, error: string }` otherwise
 */
export function validateQuestionsCount(count: unknown, maxCount: number = 50): { valid: boolean; error?: string } {
  if (typeof count !== "number") {
    return {
      valid: false,
      error: "Questions count must be a number",
    };
  }

  if (!Number.isInteger(count) || count < 1 || count > maxCount) {
    return {
      valid: false,
      error: `Questions count must be an integer between 1 and ${maxCount}`,
    };
  }

  return { valid: true };
}