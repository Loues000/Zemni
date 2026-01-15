import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

const buildRichText = (text: string): any[] => {
  if (!text) {
    return [];
  }
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part) => {
    const isBold = part.startsWith("**") && part.endsWith("**");
    const content = isBold ? part.slice(2, -2) : part;
    return {
      type: "text",
      text: { content },
      annotations: {
        bold: isBold,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default"
      }
    };
  }) as any[];
};

const paragraphBlock = (text: string): BlockObjectRequest => ({
  object: "block",
  type: "paragraph",
  paragraph: {
    rich_text: buildRichText(text)
  }
});

const headingBlock = (level: 1 | 2 | 3, text: string): BlockObjectRequest => {
  if (level === 1) {
    return {
      object: "block",
      type: "heading_1",
      heading_1: { rich_text: buildRichText(text) }
    };
  }
  if (level === 2) {
    return {
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: buildRichText(text) }
    };
  }
  return {
    object: "block",
    type: "heading_3",
    heading_3: { rich_text: buildRichText(text) }
  };
};

const bulletedBlock = (text: string): BlockObjectRequest => ({
  object: "block",
  type: "bulleted_list_item",
  bulleted_list_item: { rich_text: buildRichText(text) }
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
  if (rawCells[0] === "") {
    rawCells.shift();
  }
  if (rawCells[rawCells.length - 1] === "") {
    rawCells.pop();
  }
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
    if (!line.includes("|") || line.trim() === "") {
      break;
    }
    rows.push(parseTableRow(line));
    index += 1;
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => {
    const next = [...row];
    while (next.length < columnCount) {
      next.push("");
    }
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
        table_row: {
          cells: cells.map((cell) => buildRichText(cell))
        }
      }))
    }
  };

  return { block: tableBlock, nextIndex: index };
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

    if (line.includes("|") && isTableSeparator(lines[i + 1] ?? "")) {
      flushParagraph();
      const { block, nextIndex } = parseTable(lines, i);
      blocks.push(block);
      i = nextIndex - 1;
      continue;
    }

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

    if (line.startsWith("> ")) {
      flushParagraph();
      const quoteLines: string[] = [];
      let index = i;
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoteLines.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push(quoteBlock(quoteLines.join("\n").trim()));
      i = index - 1;
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      const items: string[] = [];
      let index = i;
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2).trim());
        index += 1;
      }
      items.forEach((item) => blocks.push(bulletedBlock(item)));
      i = index - 1;
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
};
