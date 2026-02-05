/**
 * Request validation utilities
 * Provides size validation for text and PDF uploads
 */

// Size limits in bytes
export const MAX_TEXT_SIZE = 1 * 1024 * 1024; // 1MB for text input
export const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB for PDF files

/**
 * Calculate the size of a string in bytes (UTF-8 encoding)
 */
function getTextSizeInBytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Checks whether a UTF-8 text string meets the maximum allowed text size.
 *
 * @param text - The UTF-8 string to validate.
 * @returns An object with `valid: true` when the text size is within `MAX_TEXT_SIZE`; otherwise `valid: false` and an `error` string describing the maximum and current sizes in megabytes.
 */
export function validateTextSize(text: string): { valid: boolean; error?: string } {
  const size = getTextSizeInBytes(text);
  
  if (size > MAX_TEXT_SIZE) {
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_TEXT_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `Text input exceeds maximum size of ${maxMB}MB (current: ${sizeMB}MB)`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate that a PDF buffer does not exceed the configured maximum size.
 *
 * @param buffer - Buffer containing the PDF file bytes to validate
 * @returns An object with `valid: true` when the buffer size is within the limit. If `valid` is `false`, `error` contains a message that includes the maximum allowed size and the current size in megabytes.
 */
export function validatePdfSize(buffer: Buffer): { valid: boolean; error?: string } {
  const size = buffer.length;
  
  if (size > MAX_PDF_SIZE) {
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_PDF_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `PDF file exceeds maximum size of ${maxMB}MB (current: ${sizeMB}MB)`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate that the combined UTF-8 byte size of multiple text pages does not exceed the maximum allowed text size.
 *
 * @param pages - Array of page contents whose UTF-8 byte sizes will be summed
 * @returns An object with `valid: true` if the combined size is less than or equal to the maximum; otherwise `valid: false` and `error` contains a message with the maximum and current sizes in MB
 */
export function validatePagesSize(pages: string[]): { valid: boolean; error?: string } {
  const totalSize = pages.reduce((sum, page) => sum + getTextSizeInBytes(page), 0);
  
  if (totalSize > MAX_TEXT_SIZE) {
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_TEXT_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `Total text size exceeds maximum of ${maxMB}MB (current: ${sizeMB}MB)`,
    };
  }
  
  return { valid: true };
}