import { Client } from "@notionhq/client";
import type { BlockObjectRequest, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { markdownToBlocks } from "./markdown";

/**
 * Create a Notion client with optional token
 * If no token is provided, uses the default from environment variables
 */
export function createNotionClient(token?: string) {
  const authToken = token || process.env.NOTION_TOKEN;
  if (!authToken) {
    throw new Error("Notion token is required");
  }
  return new Client({ auth: authToken });
}

// Lazy initialization - only create client when actually needed
let notionInstance: Client | null = null;
function getNotionClient(): Client {
  if (!notionInstance) {
    notionInstance = createNotionClient();
  }
  return notionInstance;
}

export type ExportProgress = 
  | { type: "started"; totalBlocks: number; totalChunks: number }
  | { type: "chunk"; index: number; totalChunks: number }
  | { type: "done"; pageId: string }
  | { type: "error"; message: string };

const DEFAULT_ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: "default" as const
};

// Notion request limits: equation expression is capped at 1000 chars.
const NOTION_EQUATION_MAX_EXPRESSION_LENGTH = 1000;

const toLegacyInlineLatexText = (expression: string) => ({
  type: "text" as const,
  text: { content: `$${expression}$` },
  annotations: { ...DEFAULT_ANNOTATIONS }
});

const toLegacyLatexCodeBlock = (expression: string): BlockObjectRequest => ({
  object: "block",
  type: "code",
  code: {
    rich_text: [
      {
        type: "text",
        text: { content: expression },
        annotations: { ...DEFAULT_ANNOTATIONS }
      }
    ],
    language: "latex"
  }
});

const isEquationTooLong = (expression: string): boolean =>
  expression.length > NOTION_EQUATION_MAX_EXPRESSION_LENGTH;

const transformRichTextForEquationHandling = (
  richText: any[] | undefined,
  forceLegacyEquationFallback: boolean
): any[] | undefined => {
  if (!Array.isArray(richText)) return richText;

  return richText.map((item) => {
    if (item?.type !== "equation") return item;

    const expression = String(item.equation?.expression || "");
    if (!expression) return item;

    if (!forceLegacyEquationFallback && !isEquationTooLong(expression)) {
      return item;
    }

    return toLegacyInlineLatexText(expression);
  });
};

const transformBlockForEquationHandling = (
  block: BlockObjectRequest,
  forceLegacyEquationFallback: boolean
): BlockObjectRequest => {
  const next: any = { ...(block as any) };

  if (next.type === "equation") {
    const expression = String(next.equation?.expression || "");
    if (!expression) return next as BlockObjectRequest;
    if (!forceLegacyEquationFallback && !isEquationTooLong(expression)) {
      return next as BlockObjectRequest;
    }
    return toLegacyLatexCodeBlock(expression);
  }

  const payloadKey = next.type;
  if (payloadKey && next[payloadKey]) {
    const payload = { ...next[payloadKey] };

    if (Array.isArray(payload.rich_text)) {
      payload.rich_text = transformRichTextForEquationHandling(
        payload.rich_text,
        forceLegacyEquationFallback
      );
    }

    if (Array.isArray(payload.children)) {
      payload.children = payload.children.map((child: BlockObjectRequest) =>
        transformBlockForEquationHandling(child, forceLegacyEquationFallback)
      );
    }

    next[payloadKey] = payload;
  }

  if (next.type === "table" && Array.isArray(next.table?.children)) {
    next.table = {
      ...next.table,
      children: next.table.children.map((child: BlockObjectRequest) =>
        transformBlockForEquationHandling(child, forceLegacyEquationFallback)
      )
    };
  }

  if (next.type === "table_row" && Array.isArray(next.table_row?.cells)) {
    next.table_row = {
      ...next.table_row,
      cells: next.table_row.cells.map((cell: any[]) =>
        transformRichTextForEquationHandling(cell, forceLegacyEquationFallback)
      )
    };
  }

  return next as BlockObjectRequest;
};

const sanitizeBlocksForEquationHandling = (
  blocks: BlockObjectRequest[],
  forceLegacyEquationFallback: boolean
): BlockObjectRequest[] =>
  blocks.map((block) =>
    transformBlockForEquationHandling(block, forceLegacyEquationFallback)
  );

const isEquationValidationError = (error: unknown): boolean => {
  const anyError = error as any;
  const message = String(anyError?.message || "").toLowerCase();
  const code = String(anyError?.code || "").toLowerCase();

  if (!message) return false;
  const mentionsEquation = message.includes("equation") || message.includes("latex");
  const isValidation = code.includes("validation") || message.includes("validation");

  return mentionsEquation && isValidation;
};

const getPageTitle = (page: PageObjectResponse): string => {
  const properties = page.properties as Record<string, any>;
  const titleProp = Object.values(properties).find((prop) => prop?.type === "title");
  if (!titleProp || titleProp.type !== "title") {
    return "Ohne Titel";
  }
  return titleProp.title.map((item: { plain_text: string }) => item.plain_text).join("");
};

/**
 * Wraps a promise with a timeout
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
};

export const listSubjects = async (databaseId: string, notionToken?: string) => {
  const client = notionToken ? createNotionClient(notionToken) : getNotionClient();
  
  try {
    const response = await withTimeout(
      client.databases.query({
        database_id: databaseId
      }),
      10000, // 10 second timeout
      "Request to Notion API timed out. Please check your connection and try again."
    );

    return response.results
      .filter((page): page is PageObjectResponse => "properties" in page)
      .map((page) => ({
        id: page.id,
        title: getPageTitle(page)
      }));
  } catch (error) {
    // Re-throw with more context if it's a timeout
    if (error instanceof Error && error.message.includes("timed out")) {
      throw error;
    }
    // Re-throw other errors as-is
    throw error;
  }
};

/**
 * Strip the leading H1 from markdown if present.
 * The page title is already set via the Notion page properties,
 * so we don't want to duplicate it as a heading block.
 */
const stripLeadingH1 = (markdown: string): string => {
  // Match a leading H1 at the start (with optional whitespace before)
  const h1Match = markdown.match(/^\s*#\s+[^\n]+\n?/);
  if (h1Match) {
    return markdown.slice(h1Match[0].length).trimStart();
  }
  return markdown;
};

export const exportSummary = async (
  subjectIdOrPageId: string | undefined,
  title: string,
  markdown: string,
  onProgress?: (progress: ExportProgress) => void,
  notionToken?: string,
  parentPageId?: string
): Promise<string> => {
  try {
    const client = notionToken ? createNotionClient(notionToken) : getNotionClient();
    const cleanedMarkdown = stripLeadingH1(markdown);
    const blocks = markdownToBlocks(cleanedMarkdown);
    const normalizedBlocks = sanitizeBlocksForEquationHandling(blocks, false);
    const totalChunks = Math.ceil(blocks.length / 100);

    onProgress?.({ type: "started", totalBlocks: blocks.length, totalChunks });
    const firstChunk = normalizedBlocks.slice(0, 100);

    // Determine parent based on what's provided
    let parent: { page_id: string } | { database_id: string } | { workspace: true };
    
    if (parentPageId) {
      // Direct page export: use provided pageId as parent
      parent = { page_id: parentPageId };
    } else if (subjectIdOrPageId) {
      // Try as database first (for subjects database export)
      try {
        await client.databases.retrieve({ database_id: subjectIdOrPageId });
        parent = { database_id: subjectIdOrPageId };
      } catch {
        // Not a database, treat as page parent
        parent = { page_id: subjectIdOrPageId };
      }
    } else {
      // No parent specified - create in workspace root
      // Note: This requires the integration to have workspace access
      parent = { workspace: true };
    }

    const createPage = async (children: BlockObjectRequest[]) =>
      client.pages.create({
        parent: parent as any,
        properties: {
          title: {
            title: [{ text: { content: title } }]
          }
        },
        children
      });

    let page: any;
    try {
      page = await createPage(firstChunk);
    } catch (error) {
      if (!isEquationValidationError(error)) {
        throw error;
      }
      const fallbackChunk = sanitizeBlocksForEquationHandling(firstChunk, true);
      page = await createPage(fallbackChunk);
    }

    onProgress?.({ type: "chunk", index: 1, totalChunks });

    const pageId = page.id;
    let index = 100;
    let chunkIndex = 2;
    while (index < normalizedBlocks.length) {
      const chunk = normalizedBlocks.slice(index, index + 100) as BlockObjectRequest[];
      const appendChunk = async (children: BlockObjectRequest[]) =>
        client.blocks.children.append({
          block_id: pageId,
          children
        });

      try {
        await appendChunk(chunk);
      } catch (error) {
        if (!isEquationValidationError(error)) {
          throw error;
        }
        const fallbackChunk = sanitizeBlocksForEquationHandling(chunk, true);
        await appendChunk(fallbackChunk);
      }
      onProgress?.({ type: "chunk", index: chunkIndex, totalChunks });
      index += 100;
      chunkIndex += 1;
    }

    onProgress?.({ type: "done", pageId });
    return pageId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Notion export error:", error);
    onProgress?.({ type: "error", message: errorMessage });
    throw error;
  }
};
