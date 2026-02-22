import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { isStandaloneLatexMathLine } from "./latex-math";

type RichTextColor = "default" | "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red" | "default_background" | "gray_background" | "brown_background" | "orange_background" | "yellow_background" | "green_background" | "blue_background" | "purple_background" | "pink_background" | "red_background";

type RichTextItemRequest =
  | {
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
    }
  | {
      type: "equation";
      equation: { expression: string };
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

const textRichText = (
  content: string,
  annotations = { ...defaultAnnotations },
  link?: { url: string } | null
): RichTextItemRequest => ({
  type: "text",
  text: { content, ...(link ? { link } : {}) },
  annotations
});

const equationRichText = (expression: string): RichTextItemRequest => ({
  type: "equation",
  equation: { expression },
  annotations: { ...defaultAnnotations }
});

const isLikelyInlineMathExpression = (expression: string): boolean => {
  const trimmed = expression.trim();
  if (!trimmed || trimmed.includes("\n")) return false;

  // Avoid obvious plain text/currency-ish spans.
  if (/^[0-9]+(?:[.,][0-9]+)?$/.test(trimmed)) return false;
  if (/^[A-Za-z]{4,}$/.test(trimmed)) return false;

  if (/\\[a-zA-Z]{2,}/.test(trimmed)) return true;
  if (/^[A-Za-z](?:[A-Za-z]{0,2})?(?:[_^][A-Za-z0-9]+)?$/.test(trimmed)) return true;
  if (/[=<>+\-*/^_]/.test(trimmed)) return true;
  if (/[\[\]{}()]/.test(trimmed) && /[A-Za-z0-9]/.test(trimmed)) return true;
  if (/^[A-Za-z]\d$/.test(trimmed) || /^\d[A-Za-z]$/.test(trimmed)) return true;

  return false;
};

const isEscapedAt = (text: string, index: number): boolean => {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
};

const findClosingMathDelimiter = (text: string, open: string, close: string): number => {
  for (let i = open.length; i <= text.length - close.length; i += 1) {
    if (text.slice(i, i + close.length) !== close) continue;
    if (isEscapedAt(text, i)) continue;
    return i;
  }
  return -1;
};

const parseInlineMath = (text: string): { match: string; expression: string } | null => {
  const delimiters: Array<{ open: string; close: string }> = [
    { open: "$$", close: "$$" },
    { open: "$", close: "$" },
    { open: "\\(", close: "\\)" },
    { open: "\\[", close: "\\]" }
  ];

  for (const delimiter of delimiters) {
    if (!text.startsWith(delimiter.open)) continue;
    const closingIndex = findClosingMathDelimiter(text, delimiter.open, delimiter.close);
    if (closingIndex === -1) return null;

    const rawExpression = text.slice(delimiter.open.length, closingIndex);
    const expression = rawExpression.trim();
    if (!expression || !isLikelyInlineMathExpression(expression)) return null;

    const end = closingIndex + delimiter.close.length;
    return {
      match: text.slice(0, end),
      expression
    };
  }

  return null;
};

const buildRichText = (text: string): RichTextItemRequest[] => {
  if (!text) {
    return [];
  }

  const parts: RichTextItemRequest[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Preserve escaped markdown tokens (e.g. \$ should stay literal)
    const escapedTokenMatch = remaining.match(/^\\([\\`*~$\[\]])/);
    if (escapedTokenMatch) {
      parts.push(textRichText(escapedTokenMatch[1], { ...defaultAnnotations }));
      remaining = remaining.slice(escapedTokenMatch[0].length);
      continue;
    }

    // Check for inline code first
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(textRichText(codeMatch[1], { ...defaultAnnotations, code: true }));
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Convert inline LaTeX to native Notion inline equation rich text.
    const inlineMathMatch = parseInlineMath(remaining);
    if (inlineMathMatch) {
      parts.push(equationRichText(inlineMathMatch.expression));
      remaining = remaining.slice(inlineMathMatch.match.length);
      continue;
    }

    // Check for markdown links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(textRichText(linkMatch[1], { ...defaultAnnotations }, { url: linkMatch[2] }));
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Check for strikethrough ~~text~~
    const strikeMatch = remaining.match(/^~~([^~]+)~~/);
    if (strikeMatch) {
      parts.push(textRichText(strikeMatch[1], { ...defaultAnnotations, strikethrough: true }));
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Check for bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(textRichText(boldMatch[1], { ...defaultAnnotations, bold: true }));
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for italic with * (but not **)
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch && !remaining.startsWith("**")) {
      parts.push(textRichText(italicMatch[1], { ...defaultAnnotations, italic: true }));
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Find next special character
    const nextSpecial = remaining.search(/[\\`*~$\[]/);
    if (nextSpecial === -1) {
      // No more special chars, add rest as plain text
      parts.push(textRichText(remaining, { ...defaultAnnotations }));
      break;
    } else if (nextSpecial === 0) {
      // Special char at start but didn't match patterns, treat as literal
      parts.push(textRichText(remaining[0], { ...defaultAnnotations }));
      remaining = remaining.slice(1);
    } else {
      // Add text before special char
      parts.push(textRichText(remaining.slice(0, nextSpecial), { ...defaultAnnotations }));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts.length > 0
    ? parts
    : [textRichText("", { ...defaultAnnotations })];
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

    // Block math ($$ ... $$ / \[ ... \]) - single line
    const trimmedLine = line.trim();
    const singleLineMathMatch = trimmedLine.match(/^\$\$(.+)\$\$$/);
    if (singleLineMathMatch) {
      flushParagraph();
      blocks.push(equationBlock(singleLineMathMatch[1].trim()));
      continue;
    }
    const singleLineBracketMathMatch = trimmedLine.match(/^\\\[(.+)\\\]$/);
    if (singleLineBracketMathMatch) {
      flushParagraph();
      blocks.push(equationBlock(singleLineBracketMathMatch[1].trim()));
      continue;
    }

    // Block math ($$ ... $$ / \[ ... \]) - multi line
    if (trimmedLine === "$$") {
      flushParagraph();
      const exprLines: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== "$$") {
        exprLines.push(lines[i]);
        i += 1;
      }
      blocks.push(equationBlock(exprLines.join("\n").trim()));
      continue;
    }
    if (trimmedLine === "\\[") {
      flushParagraph();
      const exprLines: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== "\\]") {
        exprLines.push(lines[i]);
        i += 1;
      }
      blocks.push(equationBlock(exprLines.join("\n").trim()));
      continue;
    }

    // Standalone math line detection (line looks like a math formula)
    // Detects lines with LaTeX commands or typical math patterns
    // Must come after code fence detection to avoid misdetection
    if (trimmedLine && isStandaloneLatexMathLine(trimmedLine)) {
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
