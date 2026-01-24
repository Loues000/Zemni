# AI Guidelines - Summary

These rules apply **in addition** to `guidelines/general.en.md` and only for the Summary mode.

## Structure
- Use H1 (`#`) only for large, real lecture topic blocks.
  - Align H1 titles with lecture headings whenever possible.
  - Use H1 sparingly.
- Use H2/H3 for meaningful sub-structure derived from the lecture structure.
- Do not use numbered headings.
- Do not include page/slide numbers or explicit source references.

## Format contract (strict)
- Output must be **pure Markdown**.
- Start **immediately** with the first H1 heading (`# Title`).
- No metadata, no frontmatter, no introductory chatter.
- Prefer bullet points, but short prose is allowed when needed for understanding.
- Use `**bold**` sparingly for central technical terms.
- Definitions should be written as callouts using `> ` at the beginning of the line.

## Lists (important for Notion export)
- Bullets must use `- ` (dash + space).
- Numbered lists (`1.`, `2.` ...) only for true procedures / sequences.
- Nested lists: **4 spaces indentation**, directly under the parent bullet (**no blank line**).

Example (correct):
```
- Main point
    - Subpoint 1
    - Subpoint 2
- Next main point
```

Incorrect (breaks Notion rendering):
```
- Main point

  - Subpoint with blank line above
```

## Headings
- Use at most H1-H3 (H4+ does not export reliably to Notion).
- For deeper structure, use **bold labels** within the text instead of deeper headings.

## Other Markdown rules
- Code blocks should include a language tag (e.g. ```python).
- LaTeX formulas: only standalone lines, no `$$` or `\[...\]` delimiters.
- Tables: standard Markdown tables for comparisons.
- Use `---` as a thematic divider (maps to a Notion divider).

