import { describe, expect, it } from "vitest";
import { markdownToBlocks } from "@/lib/markdown";

const getParagraphRichText = (markdown: string) => {
  const [first] = markdownToBlocks(markdown) as any[];
  expect(first?.type).toBe("paragraph");
  return first.paragraph.rich_text as any[];
};

describe("markdownToBlocks math handling", () => {
  it("converts inline $...$ to Notion inline equation rich text", () => {
    const richText = getParagraphRichText("Result: $x=y$.");
    expect(richText.some((item) => item.type === "equation" && item.equation?.expression === "x=y")).toBe(true);
  });

  it("converts inline $$...$$ to Notion inline equation rich text", () => {
    const richText = getParagraphRichText("Result: $$x=y$$.");
    expect(richText.some((item) => item.type === "equation" && item.equation?.expression === "x=y")).toBe(true);
  });

  it("converts inline \\(...\\) to Notion inline equation rich text", () => {
    const richText = getParagraphRichText("Result: \\(x=y\\).");
    expect(richText.some((item) => item.type === "equation" && item.equation?.expression === "x=y")).toBe(true);
  });

  it("keeps escaped dollars as plain text", () => {
    const richText = getParagraphRichText("Escaped: \\$x=y\\$ stays literal.");
    expect(richText.some((item) => item.type === "equation")).toBe(false);
    const joined = richText
      .filter((item) => item.type === "text")
      .map((item) => item.text?.content || "")
      .join("");
    expect(joined).toContain("$x=y$");
  });

  it("does not convert currency-like spans to equations", () => {
    const richText = getParagraphRichText("The ticket costs $500$ today.");
    expect(richText.some((item) => item.type === "equation")).toBe(false);
  });

  it("keeps display math blocks as equation blocks", () => {
    const blocks = markdownToBlocks("Before\n\n$$\nx = y\n$$\n\nAfter") as any[];
    expect(blocks.some((block) => block.type === "equation" && block.equation?.expression === "x = y")).toBe(true);
  });

  it("parses \\[ ... \\] display math blocks as equation blocks", () => {
    const blocks = markdownToBlocks("Before\n\n\\[\nx = y\n\\]\n\nAfter") as any[];
    expect(blocks.some((block) => block.type === "equation" && block.equation?.expression === "x = y")).toBe(true);
  });

  it("keeps prose lines with inline \\(...\\) as paragraphs, not standalone equation blocks", () => {
    const blocks = markdownToBlocks("where \\(f:I\\times D\\to\\mathbb{R}\\) is continuous.") as any[];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    const richText = blocks[0].paragraph.rich_text;
    expect(richText.some((item: any) => item.type === "equation" && item.equation?.expression === "f:I\\times D\\to\\mathbb{R}")).toBe(true);
  });
});
