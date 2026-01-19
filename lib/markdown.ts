import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

const buildRichText = (text: string): any[] => {
  if (!text) {
    return [];
  }
  // Handle bold (**text**), italic (*text* or _text_), and inline code (`code`)
  const parts: any[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    // Check for inline code first
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push({
        type: "text",
        text: { content: codeMatch[1] },
        annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: true, color: "default" }
      });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    
    // Check for bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push({
        type: "text",
        text: { content: boldMatch[1] },
        annotations: { bold: true, italic: false, strikethrough: false, underline: false, code: false, color: "default" }
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
        annotations: { bold: false, italic: true, strikethrough: false, underline: false, code: false, color: "default" }
      });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    
    // Find next special character
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      // No more special chars, add rest as plain text
      parts.push({
        type: "text",
        text: { content: remaining },
        annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" }
      });
      break;
    } else if (nextSpecial === 0) {
      // Special char at start but didn't match patterns, treat as literal
      parts.push({
        type: "text",
        text: { content: remaining[0] },
        annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" }
      });
      remaining = remaining.slice(1);
    } else {
      // Add text before special char
      parts.push({
        type: "text",
        text: { content: remaining.slice(0, nextSpecial) },
        annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" }
      });
      remaining = remaining.slice(nextSpecial);
    }
  }
  
  return parts.length > 0 ? parts : [{ type: "text", text: { content: "" }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" } }];
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
    rich_text: buildRichText(text),
    language: (language || "plain text") as any
  }
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

// Parse a list (bulleted or numbered) with potential nesting
const parseList = (lines: string[], startIndex: number, isBulleted: boolean): { blocks: BlockObjectRequest[]; nextIndex: number } => {
  const blocks: BlockObjectRequest[] = [];
  let index = startIndex;
  
  const getIndent = (line: string): number => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };
  
  const isListItem = (line: string): boolean => {
    if (isBulleted) {
      return /^\s*-\s+/.test(line);
    }
    return /^\s*\d+[.)]\s+/.test(line);
  };
  
  const getItemText = (line: string): string => {
    if (isBulleted) {
      return line.replace(/^\s*-\s+/, "");
    }
    return line.replace(/^\s*\d+[.)]\s+/, "");
  };
  
  const baseIndent = getIndent(lines[startIndex]);
  
  while (index < lines.length) {
    const line = lines[index];
    
    // Empty line ends list
    if (line.trim() === "") break;
    
    // Non-list line ends list
    if (!isListItem(line)) break;
    
    const currentIndent = getIndent(line);
    
    // If indent is less than base, this item belongs to parent list
    if (currentIndent < baseIndent) break;
    
    // If indent equals base, it's a sibling item
    if (currentIndent === baseIndent) {
      const text = getItemText(line);
      
      // Check for nested items
      const children: BlockObjectRequest[] = [];
      let nextIdx = index + 1;
      
      while (nextIdx < lines.length) {
        const nextLine = lines[nextIdx];
        if (nextLine.trim() === "") break;
        if (!isListItem(nextLine)) break;
        
        const nextIndent = getIndent(nextLine);
        if (nextIndent <= currentIndent) break;
        
        // Parse nested list
        const nested = parseList(lines, nextIdx, /^\s*-\s+/.test(nextLine));
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

    // Code fence
    const fenceMatch = line.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      flushParagraph();
      const language = fenceMatch[1] ?? "plain text";
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push(codeBlock(codeLines.join("\n"), language));
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

    // Bulleted list (with possible nesting)
    if (/^\s*-\s+/.test(line)) {
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
