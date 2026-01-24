# AI Guidelines — Flashcards

These rules apply **in addition** to the base rules in `guidelines/general.en.md`.

## Output language
- All generated text in `front`, `back`, and `sectionTitle` must be **German**.
- Keep English technical terms **only if** they appear in the source material (do not translate established terminology inconsistently).

## Format / Schema (strict)
- Output **only valid JSON** (no Markdown, no code fences).
- Do not put raw newlines inside JSON strings. If you must represent a line break, use `\\n`.
- Top-level shape: `{"flashcards": Flashcard[]}` (no other keys).
- Every flashcard must follow the schema exactly:
  - `sectionId: string`
  - `sectionTitle: string`
  - `type: "qa" | "cloze"`
  - `front: string`
  - `back: string`
  - `sourceSnippet: string` (verbatim quote from the section text; 1–3 sentences; max 240 chars)
  - `page?: number` (only if known)

## Card quality
- One card = **one atomic learning point** (definition, distinction, mechanism, constraint, trade-off, step, etc.).
- Avoid multi-part questions, long lists, and vague prompts ("Erklaere alles ueber ...").
- Prefer **exam-style** prompts: definitions, “why”, “how it differs from”, “when to use”, “limit/trade-off”.
- Avoid yes/no questions unless the source clearly states a binary condition.
- Do not add page numbers, citations, or "Source:" text to `front`/`back` (provenance lives only in `sourceSnippet` and `page`).

## Q/A cards
- `front`: a clear question in German, short and specific.
- `back`: the minimal correct answer (German), optionally with 1 short clarifying sentence if needed.

## Cloze cards
- `front`: a sentence/statement with **exactly one** missing span indicated as `[...]`.
- `back`: the exact missing text (the span that replaces `[...]`).
- Keep enough context in `front` so the answer is unambiguous.

## Provenance (`sourceSnippet`)
- Must be a **verbatim quote** from the given section text (no paraphrasing).
- The quote must **directly justify** the `back` answer.
- Do not fabricate sources; if the section does not support a good card, generate fewer high-quality cards rather than inventing.
  - If the quote contains line breaks, convert them to spaces or `\\n` (but keep the text verbatim otherwise).

## Conflicts with base rules
- Base rules about “no sources” do **not** apply to the JSON fields `sourceSnippet`/`page`. They still apply to the *learning text* in `front`/`back`.
