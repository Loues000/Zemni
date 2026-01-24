# AI Guidelines — Quiz

These rules apply **in addition** to the base rules in `guidelines/general.en.md`.

## Output language
- All generated text in `question`, `options`, `explanation`, and `sectionTitle` must be **German**.
- Keep English technical terms **only if** they appear in the source material.

## Format / Schema (strict)
- Output **only valid JSON** (no Markdown, no code fences).
- Do not put raw newlines inside JSON strings. If you must represent a line break, use `\\n`.
- Top-level shape: `{"questions": QuizQuestion[]}` (no other keys).
- Every question must follow the schema exactly:
  - `sectionId: string`
  - `sectionTitle: string`
  - `question: string`
  - `options: string[4]` (exactly 4)
  - `correctIndex: number` (0..3)
  - `explanation?: string` (1–2 short sentences, German)
  - `sourceSnippet: string` (verbatim quote from the section text; max 240 chars)
  - `page?: number` (only if known)

## Question quality
- Ask about **core concepts** that are explicitly covered in the section (no outside facts).
- Exactly **one** correct answer. No trick questions.
- Avoid "All of the above" / "None of the above" unless the source explicitly uses that pattern.
- Keep options **parallel** (same grammatical form, similar length) to avoid obvious tells.
- Prefer distractors that are plausible **within the same section** (related terms, common confusions, near-misses).
- Do not add page numbers or citations inside the text. Provenance lives only in `sourceSnippet`/`page`.

## Explanations
- `explanation` should briefly justify why the correct option is correct (and optionally why a common distractor is wrong).
- Keep it short and exam-focused.

## Provenance (`sourceSnippet`)
- Must be a **verbatim quote** from the given section text (no paraphrasing).
- The quote must support the correct answer clearly (avoid quotes that are too generic).
  - If the quote contains line breaks, convert them to spaces or `\\n` (but keep the text verbatim otherwise).

## Conflicts with base rules
- Base rules about “no sources” do **not** apply to the JSON fields `sourceSnippet`/`page`. They still apply to the *quiz text* itself.
