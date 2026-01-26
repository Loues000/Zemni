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

const HEADING_LINE_PATTERN = /^(#{1,6})\s+(.+)$/;
const HEADING_NUMBERING_PATTERN =
  /^\s*(?:(?:\d+(?:\.\d+)*)|(?:[IVXLCDM]+))(?:\s*[.)]|\s*[-–—])\s+/i;

const stripNumberingFromHeadings = (markdown: string): string => {
  const lines = markdown.split("\n");
  const next = lines.map((line) => {
    const match = line.match(HEADING_LINE_PATTERN);
    if (!match) return line;
    const prefix = match[1];
    const title = match[2];
    const cleaned = title.replace(HEADING_NUMBERING_PATTERN, "").trim();
    return cleaned ? `${prefix} ${cleaned}` : line;
  });
  return next.join("\n");
};

const OUTRO_PATTERNS: RegExp[] = [
  /\bdamit\s+kann\s+man\s+sich\s+gut\s+vorbereiten\b/i,
  /\bdamit\s+bist\s+du\s+.*\bvorbereitet\b/i,
  /\bso\s+kann\s+man\s+sich\s+.*\bvorbereiten\b/i,
  /\bzusammenfassend\b.*\bvorbereiten\b/i,
  /\bfazit\b.*\bvorbereiten\b/i,
  /\balles\s+(kommt|stammt|basiert)\s+aus\s+den?\s+(vorlesungsfolien|folien|slides|skript)\b/i,
  /\bdiese\s+zusammenfassung\b.*\b(vorlesungsfolien|folien|skript|slides)\b/i,
  /\b(alles|der\s+inhalt)\s+(kommt|stammt)\s+aus\s+den?\s+(folien|vorlesungen|vorlesungsfolien|skript)\b/i,
  /\bich\s+hoffe\b/i,
  /\b(viel\s+erfolg|good\s+luck)\b/i,
  /\bals\s+ki\b/i
];

const stripBannedOutro = (markdown: string): string => {
  let result = markdown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const lines = result.split("\n");
    let last = lines.length - 1;
    while (last >= 0 && lines[last].trim() === "") last -= 1;
    if (last < 0) break;

    let start = last;
    while (start >= 0 && lines[start].trim() !== "") start -= 1;
    const paragraphStart = start + 1;
    const paragraphLines = lines.slice(paragraphStart, last + 1);

    const paragraphText = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    const isHeadingParagraph = paragraphLines.every((line) => line.trim().startsWith("#"));
    const isShort = paragraphText.length > 0 && paragraphText.length <= 260 && paragraphLines.length <= 3;
    const matches = OUTRO_PATTERNS.some((pattern) => pattern.test(paragraphText));

    if (!isHeadingParagraph && isShort && matches) {
      lines.splice(paragraphStart, last - paragraphStart + 1);
      result = lines.join("\n").trimEnd();
      continue;
    }

    break;
  }

  return result.trim();
};

const normalizeOutput = (markdown: string): string => stripBannedOutro(stripNumberingFromHeadings(markdown)).trim();

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
    return normalizeOutput(result);
  }

  // If first line looks like a title (H2/H3 or plain bold text), convert to H1
  if (firstLine.startsWith("## ")) {
    lines[firstContentLineIndex] = "# " + firstLine.slice(3);
    return normalizeOutput(lines.join("\n"));
  }
  if (firstLine.startsWith("### ")) {
    lines[firstContentLineIndex] = "# " + firstLine.slice(4);
    return normalizeOutput(lines.join("\n"));
  }
  if (firstLine.startsWith("**") && firstLine.endsWith("**") && !firstLine.includes("\n")) {
    // **Title** pattern - convert to H1
    const titleText = firstLine.slice(2, -2);
    lines[firstContentLineIndex] = "# " + titleText;
    return normalizeOutput(lines.join("\n"));
  }

  // No H1 found - prepend one with fallback title or extract from content
  const titleToUse = fallbackTitle || extractTitleFromContent(result) || "Zusammenfassung";
  return normalizeOutput(`# ${titleToUse}\n\n${result}`);
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
