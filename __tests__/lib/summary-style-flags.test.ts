import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUMMARY_STYLE_FLAGS,
  SUMMARY_STYLE_FLAGS_VERSION,
  buildSummaryStyleOverridesFromMask,
  decodeSummaryStyleFlags,
  encodeSummaryStyleFlags,
  getDefaultSummaryStyleFlagsMask,
  getSummaryStyleFlagsState,
} from "@/lib/summary-style-flags";

describe("summary-style-flags", () => {
  it("encodes and decodes defaults consistently", () => {
    const defaultMask = getDefaultSummaryStyleFlagsMask();
    const decoded = decodeSummaryStyleFlags(defaultMask);
    expect(decoded).toEqual(DEFAULT_SUMMARY_STYLE_FLAGS);
  });

  it("encodes and decodes custom states consistently", () => {
    const customState = {
      useNumberedHeadings: true,
      insertDividerBeforeMajorH1: false,
      enableKeyDefinitionsBlock: true,
      enableMermaidDiagrams: false,
      enableCodeBlocks: false,
      compactBulletStyle: true,
    };
    const encoded = encodeSummaryStyleFlags(customState);
    const decoded = decodeSummaryStyleFlags(encoded);
    expect(decoded).toEqual(customState);
  });

  it("falls back to defaults when version mismatches", () => {
    const mismatched = getSummaryStyleFlagsState(0, SUMMARY_STYLE_FLAGS_VERSION + 1);
    expect(mismatched).toEqual(DEFAULT_SUMMARY_STYLE_FLAGS);
  });

  it("renders explicit override instructions", () => {
    const mask = encodeSummaryStyleFlags({
      useNumberedHeadings: true,
      insertDividerBeforeMajorH1: false,
      enableKeyDefinitionsBlock: true,
      enableMermaidDiagrams: false,
      enableCodeBlocks: true,
      compactBulletStyle: true,
    });

    const overrideText = buildSummaryStyleOverridesFromMask(mask, SUMMARY_STYLE_FLAGS_VERSION);
    expect(overrideText).toContain("Use numbered heading labels");
    expect(overrideText).toContain("Do not insert `---` dividers");
    expect(overrideText).toContain("Mermaid diagrams.");
    expect(overrideText).toContain("Keep table usage and callout usage as standard guideline defaults.");
  });
});
