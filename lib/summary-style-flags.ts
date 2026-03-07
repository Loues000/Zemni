export const SUMMARY_STYLE_FLAGS_VERSION = 1;

export const SUMMARY_STYLE_FLAG_BITS = {
  useNumberedHeadings: 1 << 0,
  insertDividerBeforeMajorH1: 1 << 1,
  enableKeyDefinitionsBlock: 1 << 2,
  enableMermaidDiagrams: 1 << 3,
  enableCodeBlocks: 1 << 4,
  compactBulletStyle: 1 << 5,
} as const;

export type SummaryStyleFlagKey = keyof typeof SUMMARY_STYLE_FLAG_BITS;
export type SummaryStyleFlagsState = Record<SummaryStyleFlagKey, boolean>;

export interface SummaryStyleFlagOption {
  key: SummaryStyleFlagKey;
  label: string;
  description: string;
}

export const SUMMARY_STYLE_FLAG_OPTIONS: SummaryStyleFlagOption[] = [
  {
    key: "useNumberedHeadings",
    label: "Numbered Headings",
    description: "Use numbered headings (for example: `## 1.2 Topic`) instead of plain heading labels.",
  },
  {
    key: "insertDividerBeforeMajorH1",
    label: "Divider Before Major Topics",
    description: "Insert `---` before each major content H1 section after the title.",
  },
  {
    key: "enableKeyDefinitionsBlock",
    label: "Key Definitions Block",
    description: "Include a dedicated `Key Definitions` block where important terms are introduced.",
  },
  {
    key: "enableMermaidDiagrams",
    label: "Mermaid Diagrams",
    description: "Use Mermaid diagrams for processes and relationships when useful.",
  },
  {
    key: "enableCodeBlocks",
    label: "Code Blocks",
    description: "Allow fenced code blocks for technical snippets and algorithmic examples.",
  },
  {
    key: "compactBulletStyle",
    label: "Compact Bullet Style",
    description: "Prefer shorter, denser bullet points over explanatory long-form bullets.",
  },
];

export const DEFAULT_SUMMARY_STYLE_FLAGS: SummaryStyleFlagsState = {
  useNumberedHeadings: false,
  insertDividerBeforeMajorH1: true,
  enableKeyDefinitionsBlock: false,
  enableMermaidDiagrams: true,
  enableCodeBlocks: true,
  compactBulletStyle: false,
};

const ALL_SUMMARY_STYLE_FLAG_BITS = Object.values(SUMMARY_STYLE_FLAG_BITS).reduce(
  (acc, bit) => acc | bit,
  0
);

export function sanitizeSummaryStyleFlagsMask(mask: unknown): number {
  if (typeof mask !== "number" || !Number.isFinite(mask)) {
    return getDefaultSummaryStyleFlagsMask();
  }
  if (!Number.isInteger(mask)) {
    return getDefaultSummaryStyleFlagsMask();
  }
  if (mask < 0) {
    return getDefaultSummaryStyleFlagsMask();
  }
  return mask & ALL_SUMMARY_STYLE_FLAG_BITS;
}

export function getDefaultSummaryStyleFlagsMask(): number {
  return encodeSummaryStyleFlags(DEFAULT_SUMMARY_STYLE_FLAGS);
}

export function decodeSummaryStyleFlags(mask?: number | null): SummaryStyleFlagsState {
  const effectiveMask =
    mask === undefined || mask === null ? getDefaultSummaryStyleFlagsMask() : sanitizeSummaryStyleFlagsMask(mask);

  const state: Partial<SummaryStyleFlagsState> = {};
  (Object.keys(SUMMARY_STYLE_FLAG_BITS) as SummaryStyleFlagKey[]).forEach((key) => {
    state[key] = (effectiveMask & SUMMARY_STYLE_FLAG_BITS[key]) !== 0;
  });
  return state as SummaryStyleFlagsState;
}

export function encodeSummaryStyleFlags(state: SummaryStyleFlagsState): number {
  let mask = 0;
  (Object.keys(SUMMARY_STYLE_FLAG_BITS) as SummaryStyleFlagKey[]).forEach((key) => {
    if (state[key]) {
      mask |= SUMMARY_STYLE_FLAG_BITS[key];
    }
  });
  return sanitizeSummaryStyleFlagsMask(mask);
}

export function getSummaryStyleFlagsState(mask?: number | null, version?: number | null): SummaryStyleFlagsState {
  if (typeof version === "number" && version !== SUMMARY_STYLE_FLAGS_VERSION) {
    return { ...DEFAULT_SUMMARY_STYLE_FLAGS };
  }
  return decodeSummaryStyleFlags(mask);
}

export function buildSummaryStyleOverrides(flags: SummaryStyleFlagsState): string {
  const lines = [
    "Summary Style Overrides (User Flags):",
    flags.useNumberedHeadings
      ? "- Use numbered heading labels in the content hierarchy."
      : "- Do not number heading labels.",
    flags.insertDividerBeforeMajorH1
      ? "- Insert `---` before major content H1 sections (after the title)."
      : "- Do not insert `---` dividers before major content H1 sections.",
    flags.enableKeyDefinitionsBlock
      ? "- Add a `Key Definitions` block for term-heavy subsections."
      : "- Omit dedicated `Key Definitions` blocks unless absolutely necessary.",
    flags.enableMermaidDiagrams
      ? "- Mermaid diagrams are allowed when they improve clarity."
      : "- Do not use Mermaid diagrams.",
    flags.enableCodeBlocks
      ? "- Fenced code blocks are allowed for technical snippets."
      : "- Do not use fenced code blocks.",
    flags.compactBulletStyle
      ? "- Prefer compact, dense bullet points with minimal prose."
      : "- Use normal explanatory bullet style (not overly compact).",
    "- Keep table usage and callout usage as standard guideline defaults.",
    "- If these overrides conflict with style rules in the summary guidelines, follow these overrides for style decisions.",
  ];

  return lines.join("\n");
}

export function buildSummaryStyleOverridesFromMask(mask?: number | null, version?: number | null): string {
  return buildSummaryStyleOverrides(getSummaryStyleFlagsState(mask, version));
}
