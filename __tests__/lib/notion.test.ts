import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportSummary } from "@/lib/notion";

const mockPagesCreate = vi.fn();
const mockBlocksAppend = vi.fn();
const mockDatabasesQuery = vi.fn();
const mockDatabasesRetrieve = vi.fn();

vi.mock("@notionhq/client", () => {
  class MockClient {
    pages = { create: mockPagesCreate };
    blocks = { children: { append: mockBlocksAppend } };
    databases = { query: mockDatabasesQuery, retrieve: mockDatabasesRetrieve };

    constructor(_: any) {}
  }

  return { Client: MockClient };
});

const buildMarkdownWithSecondChunkEquation = (): string => {
  const paragraphs = Array.from({ length: 100 }, (_, i) => `Paragraph ${i + 1}`);
  return [...paragraphs, "$$x=y$$"].join("\n\n");
};

describe("exportSummary equation handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPagesCreate.mockResolvedValue({ id: "page-1" });
    mockBlocksAppend.mockResolvedValue({});
    mockDatabasesQuery.mockResolvedValue({ results: [] });
    mockDatabasesRetrieve.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends native equation block and inline equation rich text to Notion", async () => {
    await exportSummary(undefined, "Math Export", "Inline $x=y$ and block:\n\n$$x=y$$", undefined, "token", "parent-page-id");

    expect(mockPagesCreate).toHaveBeenCalledTimes(1);
    const request = mockPagesCreate.mock.calls[0][0];
    const children = request.children as any[];

    expect(children.some((block) => block.type === "equation" && block.equation?.expression === "x=y")).toBe(true);
    const paragraph = children.find((block) => block.type === "paragraph");
    expect(paragraph).toBeTruthy();
    expect(paragraph.paragraph.rich_text.some((item: any) => item.type === "equation" && item.equation?.expression === "x=y")).toBe(true);
  });

  it("retries page creation with legacy fallback when Notion rejects equation payload", async () => {
    mockPagesCreate
      .mockRejectedValueOnce(new Error("Validation error: equation expression is invalid"))
      .mockResolvedValueOnce({ id: "page-2" });

    await exportSummary(undefined, "Math Export", "$$x=y$$", undefined, "token", "parent-page-id");

    expect(mockPagesCreate).toHaveBeenCalledTimes(2);
    const firstChildren = mockPagesCreate.mock.calls[0][0].children as any[];
    const secondChildren = mockPagesCreate.mock.calls[1][0].children as any[];

    expect(firstChildren[0].type).toBe("equation");
    expect(secondChildren[0].type).toBe("code");
    expect(secondChildren[0].code.language).toBe("latex");
  });

  it("retries append chunks with legacy fallback on equation validation errors", async () => {
    mockPagesCreate.mockResolvedValue({ id: "page-3" });
    mockBlocksAppend
      .mockRejectedValueOnce(new Error("Validation error: equation block is invalid"))
      .mockResolvedValueOnce({});

    await exportSummary(
      undefined,
      "Math Export",
      buildMarkdownWithSecondChunkEquation(),
      undefined,
      "token",
      "parent-page-id"
    );

    expect(mockBlocksAppend).toHaveBeenCalledTimes(2);
    const firstAppendChunk = mockBlocksAppend.mock.calls[0][0].children as any[];
    const secondAppendChunk = mockBlocksAppend.mock.calls[1][0].children as any[];

    expect(firstAppendChunk[0].type).toBe("equation");
    expect(secondAppendChunk[0].type).toBe("code");
    expect(secondAppendChunk[0].code.language).toBe("latex");
  });

  it("fails fast for non-equation errors without fallback retry", async () => {
    mockPagesCreate.mockRejectedValueOnce(new Error("Validation error: paragraph invalid"));

    await expect(
      exportSummary(undefined, "Math Export", "No equations here", undefined, "token", "parent-page-id")
    ).rejects.toThrow("Validation error: paragraph invalid");
    expect(mockPagesCreate).toHaveBeenCalledTimes(1);
  });
});
