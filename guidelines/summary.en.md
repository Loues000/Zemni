# AI Guidelines - Summary

These rules apply **in addition** to `guidelines/general.en.md` and only for the Summary mode.

## Structure and headings

**IMPORTANT**: The first H1 heading (`# Title`) is ONLY the document title and is NOT part of the content structure. After this title, the actual summary content begins.

**Content structure hierarchy** (after the title):
- Use `#` (H1) for main topics/chapters (equivalent to "1." in a numbered structure)
- Use `##` (H2) for subtopics (equivalent to "1.2" in a numbered structure)
- Use `###` (H3) for sub-subtopics (equivalent to "1.2.3" in a numbered structure)

**Critical rules**:
- The first H1 is the document title only. The actual content structure starts AFTER the title and should use H1 for main topics.
- Use H1 (`#`) for each major topic/chapter in the summary content (not just the title).
- Use multiple H1 headings to separate major lecture topics/chapters.
- Before each major topic H1 (`# ...`) after the title, insert a divider line `---` on its own line (with a blank line above and below). Do not put a divider before the initial title H1.
- Use H2 (`##`) for subtopics within each H1 section.
- Use H3 (`###`) to group bullets under clear sub-subtopics.
- Prefer **more** structure over long unstructured bullet dumps.

**Example structure**:
```markdown
# Document Title (required, not part of content structure)

# Main Topic 1 (first major lecture topic)
## Subtopic 1.1
### Detail 1.1.1
- Bullet points
## Subtopic 1.2
- More content

# Main Topic 2 (second major lecture topic)
## Subtopic 2.1
- Content
```

## Forbidden meta / outro
- Do not add closing sentences like "Damit kann man sich gut vorbereiten." or any other self-referential filler.
- Do not mention that you are an AI, that you summarized, or how the summary can be used.
- Do not reference an Example that you don't display on the summary.

## Format contract (strict)
- Output must be **pure Markdown**.
- Do **not** use raw HTML tags (including `<br>`). Use proper Markdown structure (separate bullets/paragraphs) instead.
- Start **immediately** with the first H1 heading (`# Title`).
- No metadata, no frontmatter, no introductory chatter.

## Lists (important for Notion export)
- Bullets must use `- ` (dash + space).
- Numbered lists (`1.`, `2.` ...) only for true procedures / sequences.
- Nested lists: **4 spaces indentation**, directly under the parent bullet (**no blank line**).

Example (correct):
```markdown
- Main point
    - Subpoint 1
    - Subpoint 2
- Next main point
```

Incorrect (breaks Notion rendering):
```markdown
- Main point

  - Subpoint with blank line above
```

## Key Definitions (bounded, optional)
If a subtopic introduces terms that need crisp definitions, add a clearly delimited block at the end of that subtopic:

- Use this exact label line: `**Key Definitions**`
- Then a bullet list with this exact shape: `- **Term**: definition`
- Keep definitions short and lecture-grounded (no external knowledge). If nothing needs defining, omit the block.

## Headings
- Use at most H1-H3 (H4+ does not export reliably to Notion).
- For deeper structure, use **bold labels** within the text instead of deeper headings.

## Markdown features and formatting

### Tables
- Use tables for comparisons, multi-column data, or structured information with multiple attributes.
- **Avoid tables with "#" or numbering columns** - use bullet points or prose instead.
- **Table cells must be single-line**: no `<br>`, no multi-paragraph content, no bullet lists inside cells.
- **Never place fenced code blocks inside tables**. If a code example is needed, put it in a dedicated subsection *after* the table.
- Example:
  ```markdown
  | Feature | Option A | Option B |
  |---------|----------|----------|
  | Speed   | Fast     | Slow     |
  | Cost    | High     | Low      |
  ```

### Diagrams and flowcharts
- Use Mermaid syntax (```mermaid code blocks) for process flows, relationships, system architectures, or any visual concepts.
- Example:
  ```mermaid
  graph TD
    A[Start] --> B[Process]
    B --> C[End]
  ```

### Code blocks
- Include a language tag for syntax highlighting (e.g. ```python, ```javascript).
- Use for algorithms, formulas, technical snippets, or any code-like content.
- Code blocks must stand alone (not inside tables).

### Callouts and emphasis
- Use blockquotes (`> `) for truly important definitions, warnings, or key takeaways. Do not overuse.
- Use `**bold**` for key concepts and technical terms.
- Use `*italic*` for emphasis or subtle distinctions.
- Use inline code (backticks) for technical terms, variables, function names, or code references.

### Other formatting
- Math / LaTeX:
  - Inline: use `$...$` for short symbols (variables, units, small expressions).
  - Display: use `$$` blocks for important formulas (prefer multi-line `$$ ... $$` when needed).
  - Keep KaTeX-compatible LaTeX (avoid obscure packages).
  - After a formula, explain variables/symbols (1-3 bullets if helpful).
- Use `---` (horizontal rule) as a thematic divider to separate major sections (maps to a Notion divider).
