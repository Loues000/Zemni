/**
 * Post-processes AI-generated summaries to ensure consistent formatting:
 * - No leading metadata (YAML frontmatter, etc.)
 * - First non-empty line must be an H1 heading (# ...)
 * - If missing H1, synthesizes one from the fallback title
 */

// Pattern to match YAML frontmatter at the start
const FRONTMATTER_PATTERN = /^---[\s\S]*?---\s*/;

// Pattern to match common metadata lines at the start
const METADATA_PATTERNS = [
  /^(Zusammenfassung|Summary|Titel|Title|Datum|Date|Autor|Author|Fach|Subject):\s*[^\n]*\n*/gi,
  /^\*\*[^*]+\*\*:\s*[^\n]*\n*/g,  // **Key**: Value
  /^-{3,}\s*\n*/g,                  // --- dividers
];

// Pattern to check if line is an H1
const H1_PATTERN = /^#\s+.+$/m;

/**
 * Removes leading metadata and ensures the summary starts with an H1 heading.
 */
export const enforceOutputFormat = (text: string, fallbackTitle?: string): string => {
  let result = text.trim();

  // Remove YAML frontmatter if present
  result = result.replace(FRONTMATTER_PATTERN, "").trim();

  // Remove common metadata patterns from the beginning
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of METADATA_PATTERNS) {
      const before = result;
      result = result.replace(pattern, "").trim();
      if (result !== before) changed = true;
    }
  }

  // Check if the first non-empty line is an H1
  const lines = result.split("\n");
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);
  
  if (firstContentLineIndex === -1) {
    // Empty content - return with title if provided
    return fallbackTitle ? `# ${fallbackTitle}\n` : "";
  }

  const firstLine = lines[firstContentLineIndex].trim();
  
  // If first line is already H1, we're good
  if (firstLine.startsWith("# ")) {
    return result;
  }

  // If first line looks like a title (H2/H3 or plain bold text), convert to H1
  if (firstLine.startsWith("## ")) {
    lines[firstContentLineIndex] = "# " + firstLine.slice(3);
    return lines.join("\n").trim();
  }
  if (firstLine.startsWith("### ")) {
    lines[firstContentLineIndex] = "# " + firstLine.slice(4);
    return lines.join("\n").trim();
  }
  if (firstLine.startsWith("**") && firstLine.endsWith("**") && !firstLine.includes("\n")) {
    // **Title** pattern - convert to H1
    const titleText = firstLine.slice(2, -2);
    lines[firstContentLineIndex] = "# " + titleText;
    return lines.join("\n").trim();
  }

  // No H1 found - prepend one with fallback title or extract from content
  const titleToUse = fallbackTitle || extractTitleFromContent(result) || "Zusammenfassung";
  return `# ${titleToUse}\n\n${result}`;
};

/**
 * Attempts to extract a reasonable title from the content.
 */
const extractTitleFromContent = (text: string): string | null => {
  // Try to find the first heading of any level
  const headingMatch = text.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }

  // Try to find a bold text at the start that could be a title
  const boldMatch = text.match(/^\*\*([^*]+)\*\*/);
  if (boldMatch && boldMatch[1] && boldMatch[1].length < 100) {
    return boldMatch[1].trim();
  }

  return null;
};

/**
 * Extracts the title from a summary (the H1 text).
 */
export const extractTitleFromSummary = (summary: string): string | null => {
  const match = summary.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
};
