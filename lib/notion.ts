import { Client } from "@notionhq/client";
import type { BlockObjectRequest, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { markdownToBlocks } from "./markdown";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const getPageTitle = (page: PageObjectResponse): string => {
  const properties = page.properties as Record<string, any>;
  const titleProp = Object.values(properties).find((prop) => prop?.type === "title");
  if (!titleProp || titleProp.type !== "title") {
    return "Ohne Titel";
  }
  return titleProp.title.map((item: { plain_text: string }) => item.plain_text).join("");
};

export const listSubjects = async (databaseId: string) => {
  const response = await notion.databases.query({
    database_id: databaseId
  });

  return response.results
    .filter((page): page is PageObjectResponse => "properties" in page)
    .map((page) => ({
      id: page.id,
      title: getPageTitle(page)
    }));
};

export const exportSummary = async (
  subjectId: string,
  title: string,
  markdown: string
): Promise<string> => {
  const blocks = markdownToBlocks(markdown);
  const firstChunk = blocks.slice(0, 100);

  const page = await notion.pages.create({
    parent: { page_id: subjectId },
    properties: {
      title: {
        title: [{ text: { content: title } }]
      }
    },
    children: firstChunk
  });

  const pageId = page.id;
  let index = 100;
  while (index < blocks.length) {
    const chunk = blocks.slice(index, index + 100) as BlockObjectRequest[];
    await notion.blocks.children.append({
      block_id: pageId,
      children: chunk
    });
    index += 100;
  }

  return pageId;
};
