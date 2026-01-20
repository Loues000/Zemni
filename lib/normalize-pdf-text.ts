/**
 * Normalizes extracted PDF text to improve quality and reduce token count.
 * 
 * Operations:
 * - De-hyphenate line breaks (exam-\nple → example)
 * - Collapse excessive whitespace
 * - Remove repeated header/footer lines
 */

/**
 * De-hyphenates words split across line breaks.
 * Example: "exam-\nple" becomes "example"
 */
const dehyphenate = (text: string): string => {
  // Match hyphen at end of line followed by continuation
  // Be careful not to dehyphenate intentional hyphens (like compound words at line ends)
  return text.replace(/(\w)-\n(\w)/g, (_, before, after) => {
    // Only dehyphenate if the result looks like a word (lowercase continuation)
    if (after === after.toLowerCase()) {
      return before + after;
    }
    return `${before}-\n${after}`;
  });
};

/**
 * Collapses excessive whitespace while preserving paragraph structure.
 */
const collapseWhitespace = (text: string): string => {
  // Replace multiple spaces with single space
  let result = text.replace(/ {2,}/g, " ");
  
  // Replace multiple newlines (3+) with double newline (paragraph break)
  result = result.replace(/\n{3,}/g, "\n\n");
  
  // Remove trailing spaces from lines
  result = result.replace(/ +\n/g, "\n");
  
  // Remove leading spaces from lines (but preserve indentation for code)
  // Only remove if it's excessive (4+ spaces that aren't code-like)
  result = result.replace(/\n {4,}(?=[A-Z])/g, "\n");
  
  return result.trim();
};

/**
 * Identifies and removes repeated header/footer lines.
 * A line is considered a header/footer if it appears on many pages.
 */
const removeRepeatedHeaderFooter = (text: string): string => {
  const lines = text.split("\n");
  const lineCount: Map<string, number> = new Map();
  
  // Count occurrences of each line (normalized)
  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    if (normalized.length > 0 && normalized.length < 100) {
      lineCount.set(normalized, (lineCount.get(normalized) || 0) + 1);
    }
  }
  
  // Find lines that appear frequently (likely headers/footers)
  // Threshold: appears more than 5 times and is short (typical of headers/footers)
  const frequentLines = new Set<string>();
  for (const [line, count] of lineCount.entries()) {
    // Common patterns for headers/footers:
    // - Page numbers (just digits)
    // - Short repeated text (university name, course name, etc.)
    if (count >= 5) {
      // Skip if it's likely actual content (long lines with multiple words)
      const wordCount = line.split(/\s+/).length;
      if (wordCount <= 6 || /^\d+$/.test(line)) {
        frequentLines.add(line);
      }
    }
  }
  
  // Remove frequent header/footer lines
  const filteredLines = lines.filter((line) => {
    const normalized = line.trim().toLowerCase();
    return !frequentLines.has(normalized);
  });
  
  return filteredLines.join("\n");
};

/**
 * Normalizes PDF text with all cleaning operations.
 */
export const normalizePdfText = (text: string): string => {
  if (!text) return "";
  
  let result = text;
  
  // Apply normalization steps in order
  result = dehyphenate(result);
  result = removeRepeatedHeaderFooter(result);
  result = collapseWhitespace(result);
  
  return result;
};
