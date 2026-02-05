# AI Guidelines - General

These rules apply to all modes (Summary / Flashcards / Quiz).
Mode-specific add-ons may add further constraints, but may not weaken the core "no hallucination" rules.

## Output language
- The output language is determined by the user's preference and will be specified in the prompt.
- Keep technical terms from the source material as-is (do not translate established terminology inconsistently).

## Inputs and sources (hard rules)
- The only source of truth is the user-provided lecture material (PDF/slides/markdown).
- Do not use external sources and do not add outside knowledge.
- Ignore organizational slides, repetition/recap slides, meta slides, and non-content material.
- Interpret the content meaningfully; do not copy-paste large text blocks.

## Style
- Explain, be precise, and be direct.
- No marketing tone, no filler phrases, no "nice to have" fluff.
- Avoid bullet spam without explanation: prefer short, high-signal statements that actually teach.
- The goal is understanding, not just re-stating.

## Depth requirements (must-have)
For each topic you cover, ensure it is:
- self-contained (understandable on its own),
- motivated (why it exists / what problem it solves),
- defined (key terms are clearly defined),
- connected (relationships between concepts are explained),
- bounded (limitations, trade-offs, typical pitfalls are mentioned),
- grounded (examples / application contexts are included if present in the source material).

Not allowed:
- "This will be covered later" / "As you already know"
- References to other chapters without explanation

## Closeness to the lecture (very important)
- Keep the lecture's terminology consistently.
- Do not reorder content arbitrarily; preserve the lecture's progression.
- Do not reference diagrams/figures initially; do not invent descriptions for visuals.
- Target feeling: "This is exactly the slide I know - just explained."

## Math / technical content (if present)
- Only include formulas that appear in the lecture material.
- Always explain formulas; use clean LaTeX where needed.
- No unnecessary derivations.
- If the lecture uses numbering for theorems/examples, that numbering may be preserved.
- Focus on meaning, interpretation, usage, and limits.

## Domain-specific (MCI / Multimedia / SWE / DB / OS)
- Clearly separate interaction vs technology vs perception.
- For systems: architecture, interaction, user perspective.
- For processes: steps, motivation, consequences.
- For comparisons: clear separation, no mixing of concepts.

## Things you must NOT do
- No generic textbook knowledge.
- No "summary of the summary".
- No organizational content.
- No page/slide numbers or citations in the learning text.
- **Never use numbered headings** like `## 1. Introduction` or `## 1.2 Details`. Use markdown heading levels (`#`, `##`, `###`) instead to represent hierarchical structure.

## Completeness requirements (critical)
- You MUST cover ALL topics, concepts, mechanisms, and details mentioned in the source material.
- Do not skip or omit any important information to save space - the goal is completeness and understanding, not brevity.
- If the source material mentions multiple aspects, features, or examples for a topic, include all of them.
- Include all necessary details: definitions, mechanisms, reasons, trade-offs, and edge cases.
- If you approach the output token limit, prioritize breadth (ensuring all topics are covered) over excessive detail on single topics.

## Goal / quality bar
The output must:
- work as standalone learning material,
- be directly useful for exam preparation,
- cover exactly what the lecture teaches,
- leave no knowledge gaps.

Quality check:
> "If I learn only this, I fully understand the lecture and recognize every slide - without having to memorize it blindly."

## Provenance exception for JSON modes
Rules like "no sources/citations" apply to the learning text.
For Flashcards/Quiz JSON outputs, provenance fields such as `sourceSnippet` and `page` are allowed and expected.

