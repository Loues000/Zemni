import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

type RichTextColor = "default" | "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red" | "default_background" | "gray_background" | "brown_background" | "orange_background" | "yellow_background" | "green_background" | "blue_background" | "purple_background" | "pink_background" | "red_background";

type RichTextItemRequest = {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: RichTextColor;
  };
};

const defaultAnnotations = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: "default" as RichTextColor
};

const buildRichText = (text: string): RichTextItemRequest[] => {
  if (!text) {
    return [];
  }

  const parts: RichTextItemRequest[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Check for inline code first
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push({
        type: "text",
        text: { content: codeMatch[1] },
        annotations: { ...defaultAnnotations, code: true }
      });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Check for inline math ($...$) - convert to code style
    const inlineMathMatch = remaining.match(/^\$([^$]+)\$/);
    if (inlineMathMatch && !remaining.startsWith("$$")) {
      parts.push({
        type: "text",
        text: { content: inlineMathMatch[1] },
        annotations: { ...defaultAnnotations, code: true }
      });
      remaining = remaining.slice(inlineMathMatch[0].length);
      continue;
    }

    // Check for markdown links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push({
        type: "text",
        text: { content: linkMatch[1], link: { url: linkMatch[2] } },
        annotations: { ...defaultAnnotations }
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Check for strikethrough ~~text~~
    const strikeMatch = remaining.match(/^~~([^~]+)~~/);
    if (strikeMatch) {
      parts.push({
        type: "text",
        text: { content: strikeMatch[1] },
        annotations: { ...defaultAnnotations, strikethrough: true }
      });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Check for bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push({
        type: "text",
        text: { content: boldMatch[1] },
        annotations: { ...defaultAnnotations, bold: true }
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for italic with * (but not **)
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch && !remaining.startsWith("**")) {
      parts.push({
        type: "text",
        text: { content: italicMatch[1] },
        annotations: { ...defaultAnnotations, italic: true }
      });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Find next special character
    const nextSpecial = remaining.search(/[`*~$\[]/);
    if (nextSpecial === -1) {
      // No more special chars, add rest as plain text
      parts.push({
        type: "text",
        text: { content: remaining },
        annotations: { ...defaultAnnotations }
      });
      break;
    } else if (nextSpecial === 0) {
      // Special char at start but didn't match patterns, treat as literal
      parts.push({
        type: "text",
        text: { content: remaining[0] },
        annotations: { ...defaultAnnotations }
      });
      remaining = remaining.slice(1);
    } else {
      // Add text before special char
      parts.push({
        type: "text",
        text: { content: remaining.slice(0, nextSpecial) },
        annotations: { ...defaultAnnotations }
      });
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts.length > 0
    ? parts
    : [{ type: "text", text: { content: "" }, annotations: { ...defaultAnnotations } }];
};

const paragraphBlock = (text: string): BlockObjectRequest => ({
  object: "block",
  type: "paragraph",
  paragraph: { rich_text: buildRichText(text) }
});

const headingBlock = (level: 1 | 2 | 3, text: string): BlockObjectRequest => {
  if (level === 1) {
    return { object: "block", type: "heading_1", heading_1: { rich_text: buildRichText(text) } };
  }
  if (level === 2) {
    return { object: "block", type: "heading_2", heading_2: { rich_text: buildRichText(text) } };
  }
  return { object: "block", type: "heading_3", heading_3: { rich_text: buildRichText(text) } };
};

const bulletedBlock = (text: string, children?: BlockObjectRequest[]): BlockObjectRequest => {
  const block: any = {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: buildRichText(text) }
  };
  if (children && children.length > 0) {
    block.bulleted_list_item.children = children;
  }
  return block;
};

const numberedBlock = (text: string, children?: BlockObjectRequest[]): BlockObjectRequest => {
  const block: any = {
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: { rich_text: buildRichText(text) }
  };
  if (children && children.length > 0) {
    block.numbered_list_item.children = children;
  }
  return block;
};

const dividerBlock = (): BlockObjectRequest => ({
  object: "block",
  type: "divider",
  divider: {}
});

const quoteBlock = (text: string): BlockObjectRequest => ({
  object: "block",
  type: "quote",
  quote: { rich_text: buildRichText(text) }
});

const codeBlock = (text: string, language?: string): BlockObjectRequest => ({
  object: "block",
  type: "code",
  code: {
    rich_text: [{ type: "text", text: { content: text }, annotations: { ...defaultAnnotations } }],
    language: (language || "plain text") as any
  }
});

const equationBlock = (expression: string): BlockObjectRequest => ({
  object: "block",
  type: "equation",
  equation: { expression }
});

/**
 * Detects if a line is a standalone math formula.
 * Focuses on LaTeX commands - only detect lines that clearly contain LaTeX.
 */
const isStandaloneMathLine = (line: string): boolean => {
  // Must have some content
  if (line.length < 3) return false;
  
  // Skip if it looks like a heading, list, or other markdown
  if (/^[#\-*+>\d`]/.test(line)) return false;
  if (line.startsWith("|")) return false; // table
  if (line.startsWith("//") || line.startsWith("/*")) return false; // comments
  
  // Must have at least one LaTeX command (backslash followed by letters)
  const hasLatexCommand = /\\[a-zA-Z]{2,}/.test(line);
  if (!hasLatexCommand) return false;
  
  // Common LaTeX math patterns that strongly indicate this is a formula
  const latexPatterns = [
    /\\frac\s*[{(]/,    // fractions
    /\\sum/,            // summation
    /\\prod/,           // product
    /\\int/,            // integral
    /\\lim/,            // limit
    /\\sqrt/,           // square root
    /\\partial/,        // partial derivative
    /\\nabla/,          // nabla/gradient
    /\\infty/,          // infinity
    /\\cdot/,           // center dot
    /\\times/,          // times
    /\\div/,            // division
    /\\pm/,             // plus-minus
    /\\leq|\\geq|\\neq/, // comparisons
    /\\alpha|\\beta|\\gamma|\\delta|\\epsilon/, // Greek
    /\\theta|\\lambda|\\mu|\\sigma|\\omega/,     // Greek
    /\\left[(\[{|]/,    // left delimiter
    /\\right[)\]}|]/,   // right delimiter
    /\\begin\{/,        // environment start
    /\\end\{/,          // environment end
    /\\mathbb|\\mathcal|\\mathrm/, // math fonts
    /\\vec|\\hat|\\bar/, // vector notations
    /\\sin|\\cos|\\tan|\\log|\\ln|\\exp/, // functions
  ];
  
  // Must match at least one LaTeX math pattern
  return latexPatterns.some(p => p.test(line));
};

const parseTableRow = (line: string): string[] => {
  const trimmed = line.trim();
  const rawCells = trimmed.split("|").map((cell) => cell.trim());
  if (rawCells[0] === "") rawCells.shift();
  if (rawCells[rawCells.length - 1] === "") rawCells.pop();
  return rawCells;
};

const isTableSeparator = (line: string): boolean => {
  return /^\s*\|?[\s:-]+\|[\s|:-]*\s*$/.test(line);
};

const parseTable = (lines: string[], startIndex: number) => {
  const header = parseTableRow(lines[startIndex]);
  const rows: string[][] = [header];
  let index = startIndex + 2;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.includes("|") || line.trim() === "") break;
    rows.push(parseTableRow(line));
    index += 1;
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => {
    const next = [...row];
    while (next.length < columnCount) next.push("");
    return next;
  });

  const tableBlock: BlockObjectRequest = {
    object: "block",
    type: "table",
    table: {
      table_width: columnCount,
      has_column_header: true,
      has_row_header: false,
      children: normalized.map((cells) => ({
        object: "block",
        type: "table_row",
        table_row: { cells: cells.map((cell) => buildRichText(cell)) }
      }))
    }
  };

  return { block: tableBlock, nextIndex: index };
};

/**
 * Calculate indent level, normalizing tabs to 2 spaces.
 */
const getIndentLevel = (line: string): number => {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  const whitespace = match[1];
  // Count tabs as 2 spaces, then divide by 2 to get level
  const spaces = whitespace.replace(/\t/g, "  ").length;
  return Math.floor(spaces / 2);
};

/**
 * Parse a list (bulleted or numbered) with improved nesting support.
 * Handles mixed spaces/tabs and both bullet types in nested lists.
 */
const parseList = (
  lines: string[],
  startIndex: number,
  isBulleted: boolean
): { blocks: BlockObjectRequest[]; nextIndex: number } => {
  const blocks: BlockObjectRequest[] = [];
  let index = startIndex;

  const isBulletedItem = (line: string): boolean => /^\s*[-*+]\s+/.test(line);
  const isNumberedItem = (line: string): boolean => /^\s*\d+[.)]\s+/.test(line);
  const isListItem = (line: string): boolean => isBulletedItem(line) || isNumberedItem(line);

  const getItemText = (line: string): string => {
    if (isBulletedItem(line)) {
      return line.replace(/^\s*[-*+]\s+/, "");
    }
    return line.replace(/^\s*\d+[.)]\s+/, "");
  };

  const baseLevel = getIndentLevel(lines[startIndex]);

  while (index < lines.length) {
    const line = lines[index];

    // Empty line ends list
    if (line.trim() === "") break;

    // Non-list line ends list
    if (!isListItem(line)) break;

    const currentLevel = getIndentLevel(line);

    // If indent is less than base, this item belongs to parent list
    if (currentLevel < baseLevel) break;

    // If indent equals base, it's a sibling item
    if (currentLevel === baseLevel) {
      const text = getItemText(line);
      const isCurrentBulleted = isBulletedItem(line);

      // Only process if this item matches the list type we're parsing
      // (allows mixed list types at different nesting levels)
      if (isBulleted !== isCurrentBulleted && currentLevel === baseLevel) {
        break;
      }

      // Check for nested items
      const children: BlockObjectRequest[] = [];
      let nextIdx = index + 1;

      while (nextIdx < lines.length) {
        const nextLine = lines[nextIdx];
        if (nextLine.trim() === "") break;
        if (!isListItem(nextLine)) break;

        const nextLevel = getIndentLevel(nextLine);
        if (nextLevel <= currentLevel) break;

        // Parse nested list (detect type from the nested item)
        const nestedIsBulleted = isBulletedItem(nextLine);
        const nested = parseList(lines, nextIdx, nestedIsBulleted);
        children.push(...nested.blocks);
        nextIdx = nested.nextIndex;
      }

      if (isBulleted) {
        blocks.push(bulletedBlock(text, children.length > 0 ? children : undefined));
      } else {
        blocks.push(numberedBlock(text, children.length > 0 ? children : undefined));
      }

      index = nextIdx;
      continue;
    }

    // Deeper indent - shouldn't happen at top level, skip
    index += 1;
  }

  return { blocks, nextIndex: index };
};

export const markdownToBlocks = (markdown: string): BlockObjectRequest[] => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockObjectRequest[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      blocks.push(paragraphBlock(paragraphBuffer.join("\n")));
      paragraphBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // Block equation ($$...$$)
    if (line.trim().startsWith("$$")) {
      flushParagraph();
      // Check if it's a single-line equation $$...$$ on one line
      const singleLineMatch = line.match(/^\s*\$\$(.+)\$\$\s*$/);
      if (singleLineMatch) {
        blocks.push(equationBlock(singleLineMatch[1].trim()));
        continue;
      }
      // Multi-line equation
      const equationLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("$$")) {
        equationLines.push(lines[i]);
        i += 1;
      }
      blocks.push(equationBlock(equationLines.join("\n").trim()));
      continue;
    }

    // LaTeX display math \[...\] (single or multi-line)
    if (line.trim().startsWith("\\[")) {
      flushParagraph();
      // Check if it's a single-line \[...\]
      const singleLineLatex = line.match(/^\s*\\\[(.+)\\\]\s*$/);
      if (singleLineLatex) {
        blocks.push(equationBlock(singleLineLatex[1].trim()));
        continue;
      }
      // Multi-line - collect until \]
      const latexLines: string[] = [line.replace(/^\s*\\\[\s*/, "")];
      i += 1;
      while (i < lines.length && !lines[i].includes("\\]")) {
        latexLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) {
        latexLines.push(lines[i].replace(/\\\]\s*$/, ""));
      }
      blocks.push(equationBlock(latexLines.join("\n").trim()));
      continue;
    }

    // Code fence (```language or just ```)
    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      flushParagraph();
      const language = fenceMatch[1] || "plain text";
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push(codeBlock(codeLines.join("\n"), language));
      continue;
    }

    // Standalone math line detection (line looks like a math formula)
    // Detects lines with LaTeX commands or typical math patterns
    // Must come after code fence detection to avoid misdetection
    const trimmedLine = line.trim();
    if (trimmedLine && isStandaloneMathLine(trimmedLine)) {
      flushParagraph();
      blocks.push(equationBlock(trimmedLine));
      continue;
    }

    // Indented code blocks (4+ spaces) - NOT SUPPORTED
    // Remove indentation and treat as normal text
    // Use ``` code fences instead for code blocks
    if (/^ {4,}/.test(line) || /^\t/.test(line)) {
      // Simply remove leading indentation (4+ spaces or tabs) and treat as normal text
      const deindented = line.replace(/^ {4,}/, "").replace(/^\t+/, "");
      paragraphBuffer.push(deindented);
      continue;
    }

    // Table
    if (line.includes("|") && isTableSeparator(lines[i + 1] ?? "")) {
      flushParagraph();
      const { block, nextIndex } = parseTable(lines, i);
      blocks.push(block);
      i = nextIndex - 1;
      continue;
    }

    // Horizontal rule (---, ***, ___)
    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      flushParagraph();
      blocks.push(dividerBlock());
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push(headingBlock(1, line.replace(/^#\s+/, "")));
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push(headingBlock(2, line.replace(/^##\s+/, "")));
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push(headingBlock(3, line.replace(/^###\s+/, "")));
      continue;
    }
    if (line.startsWith("#### ")) {
      flushParagraph();
      // Notion only has h1-h3, so h4 becomes h3
      blocks.push(headingBlock(3, line.replace(/^####\s+/, "")));
      continue;
    }

    // Quote
    if (line.startsWith("> ")) {
      flushParagraph();
      const quoteLines: string[] = [];
      let index = i;
      while (index < lines.length && (lines[index].startsWith("> ") || lines[index] === ">")) {
        const qLine = lines[index];
        quoteLines.push(qLine.startsWith("> ") ? qLine.slice(2) : "");
        index += 1;
      }
      blocks.push(quoteBlock(quoteLines.join("\n").trim()));
      i = index - 1;
      continue;
    }

    // Bulleted list (with possible nesting, supports -, *, +)
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      const { blocks: listBlocks, nextIndex } = parseList(lines, i, true);
      blocks.push(...listBlocks);
      i = nextIndex - 1;
      continue;
    }

    // Numbered list (with possible nesting)
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const { blocks: listBlocks, nextIndex } = parseList(lines, i, false);
      blocks.push(...listBlocks);
      i = nextIndex - 1;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    // Regular text - add to paragraph buffer
    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
};
