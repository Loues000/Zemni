# AI Guidelines - Summary

These rules apply **in addition** to `guidelines/general.en.md` and only for the Summary mode.

## Structure and headings

**IMPORTANT**: The first H1 heading (`# Title`) is ONLY the document title and is NOT part of the content structure. After this title, the actual summary content begins.

**Content structure hierarchy** (after the title):
- Use `#` (H1) for main topics/chapters (equivalent to "1." in a numbered structure)
- Use `##` (H2) for subtopics (equivalent to "1.2" in a numbered structure)
- Use `###` (H3) for sub-subtopics (equivalent to "1.2.3" in a numbered structure)

**Critical rules**:
- Do NOT use numbered headings like `## 1. Introduction` or `## 1.2 Details`. Use markdown heading levels (`#`, `##`, `###`) instead.
- The first H1 is the document title only. The actual content structure starts AFTER the title and should use H1 for main topics.
- Use H1 (`#`) for each major topic/chapter in the summary content (not just the title).
- Use multiple H1 headings to separate major lecture topics/chapters.
- Use H2 (`##`) for subtopics within each H1 section.
- Use H3 (`###`) to group bullets under clear sub-subtopics.
- Prefer **more** structure over long unstructured bullet dumps.

**Example structure**:
```
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
- Do not reference an Example that you dont display on the summary.

## Format contract (strict)
- Output must be **pure Markdown**.
- Start **immediately** with the first H1 heading (`# Title`) - this is the document title only.
- **After the title**, begin the actual summary content using H1 headings for main topics.
- The title H1 is separate from the content structure - use H1 again in the content for main topics.
- No metadata, no frontmatter, no introductory chatter.
- Use tables for comparisons, multi-column data, or structured information with multiple attributes.
- **Do not use tables with "#" or numbering columns** - use bullet points or prose instead.
- Prefer bullet points for simple lists and sequential information.
- Short prose is allowed when needed for understanding.
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

## Markdown features and formatting

### Tables
- Use tables for comparisons, multi-column data, or structured information with multiple attributes.
- **Avoid tables with "#" or numbering columns** - use bullet points or prose instead.
- Example:
  ```
  | Feature | Option A | Option B |
  |---------|----------|----------|
  | Speed   | Fast     | Slow     |
  | Cost    | High     | Low      |
  ```

### Diagrams and flowcharts
- Use Mermaid syntax (```mermaid code blocks) for process flows, relationships, system architectures, or any visual concepts.
- Example:
  ```
  ```mermaid
  graph TD
    A[Start] --> B[Process]
    B --> C[End]
  ```
  ```

### Code blocks
- Include a language tag for syntax highlighting (e.g. ```python, ```javascript).
- Use for algorithms, formulas, technical snippets, or any code-like content.

### Callouts and emphasis
- Use `> ` (blockquote) for definitions, important notes, warnings, or key takeaways.
- Use `**bold**` for key concepts and technical terms.
- Use `*italic*` for emphasis or subtle distinctions.
- Use inline code (backticks) for technical terms, variables, function names, or code references.

### Lists
- **Completeness over brevity**: Include ALL important concepts from the source material.
- Per subsection: Include all relevant points (typically 5-15 bullet points, more if content requires it).
- Use nested lists for hierarchical information (4 spaces indentation, no blank line between parent and child).
- Numbered lists (`1.`, `2.` ...) only for true procedures or sequences where order matters.

### Other formatting
- Math / LaTeX:
  - Inline: use `$...$` for short symbols (variables, units, small expressions).
  - Display: use `$$` blocks for important formulas (prefer multi-line `$$ ... $$` when needed).
  - Keep KaTeX-compatible LaTeX (avoid obscure packages).
  - After a formula, explain variables/symbols (1-3 bullets if helpful).
- Use `---` (horizontal rule) as a thematic divider to separate major sections (maps to a Notion divider).

