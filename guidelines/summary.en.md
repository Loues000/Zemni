# AI Guidelines - Summary

These rules apply **in addition** to `guidelines/general.en.md` and only for the Summary mode.

## Structure
- Use H1 (`#`) only for large, real lecture topic blocks.
  - Align H1 titles with lecture headings whenever possible.
  - Use H1 sparingly.
- Use H2/H3 for meaningful sub-structure derived from the lecture structure.
- Prefer **more** structure over long unstructured bullet dumps:
  - Use multiple H2 blocks for major subtopics.
  - Use H3 to group bullets under a clear sub-subtopic.
- Really try to bring a structure in the dummarie via the different headlines, a summary only using the same headline typ over and over is not allowed.
- Do not use numbered headings.
- Do not include page/slide numbers or explicit source references.

## Forbidden meta / outro
- Do not add closing sentences like "Damit kann man sich gut vorbereiten." / "Alles kommt aus den Vorlesungsfolien." / "Diese Zusammenfassung basiert auf ..." or any other self-referential filler.
- Do not mention that you are an AI, that you summarized, or how the summary can be used.

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
- Math / LaTeX:
  - Inline: use `$...$` for short symbols (variables, units, small expressions).
  - Display: use `$$` blocks for important formulas (prefer multi-line `$$ ... $$` when needed).
  - Keep KaTeX-compatible LaTeX (avoid obscure packages).
  - After a formula, explain variables/symbols in plain German (1-3 bullets if helpful).
- Tables: standard Markdown tables for comparisons.
- Use `---` as a thematic divider (maps to a Notion divider).

