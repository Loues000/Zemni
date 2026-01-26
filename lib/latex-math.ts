const HEADING_OR_LIST_PREFIX = /^[#\-*+>\d`]/;

/**
 * Detects if a line is very likely a standalone LaTeX math formula.
 * Used for both Notion export and Markdown preview niceties.
 */
export const isStandaloneLatexMathLine = (line: string): boolean => {
  if (line.length < 3) return false;

  // Skip if it looks like a heading, list, or other markdown.
  if (HEADING_OR_LIST_PREFIX.test(line)) return false;
  if (line.startsWith("|")) return false; // table
  if (line.startsWith("//") || line.startsWith("/*")) return false; // comments
  if (line.startsWith("$")) return false; // already delimited

  // Must have at least one LaTeX command (backslash followed by letters)
  const hasLatexCommand = /\\[a-zA-Z]{2,}/.test(line);
  if (!hasLatexCommand) return false;

  const latexPatterns = [
    /\\frac\s*[{(]/,
    /\\sum/,
    /\\prod/,
    /\\int/,
    /\\lim/,
    /\\sqrt/,
    /\\partial/,
    /\\nabla/,
    /\\infty/,
    /\\cdot/,
    /\\times/,
    /\\div/,
    /\\pm/,
    /\\leq|\\geq|\\neq/,
    /\\alpha|\\beta|\\gamma|\\delta|\\epsilon/,
    /\\theta|\\lambda|\\mu|\\sigma|\\omega/,
    /\\left[(\[{|]/,
    /\\right[)\]}|]/,
    /\\begin\{/,
    /\\end\{/,
    /\\mathbb|\\mathcal|\\mathrm/,
    /\\vec|\\hat|\\bar/,
    /\\sin|\\cos|\\tan|\\log|\\ln|\\exp/
  ];

  return latexPatterns.some((pattern) => pattern.test(line));
};

