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
 * Validate text input size
 * Returns validation result with error message if invalid
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
 * Validate PDF file size
 * Returns validation result with error message if invalid
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
 * Validate total size of multiple text pages
 * Used for PDF pages array
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
