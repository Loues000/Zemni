import type { Flashcard, QuizQuestion } from "@/types";

const toBaseName = (fileName: string): string => {
  const trimmed = (fileName || "").trim();
  if (!trimmed) return "document";
  return trimmed.replace(/\.[^.]+$/, "");
};

const tsvEscape = (value: string): string => {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, "<br>");
};

export const flashcardsToTsv = (cards: Flashcard[], fileName: string): { fileName: string; content: string } => {
  const base = toBaseName(fileName);
  const lines = cards.map((c) => {
    const front = tsvEscape(c.front);
    const back = tsvEscape(c.back);
    const source = tsvEscape(c.sourceSnippet);
    return `${front}\t${back}\t${source}`;
  });
  return { fileName: `${base}-flashcards.tsv`, content: lines.join("\n") + "\n" };
};

const lettersFor = (count: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(String.fromCharCode(65 + i));
  }
  return out;
};

export const quizToMarkdown = (questions: QuizQuestion[], fileName: string): { fileName: string; content: string } => {
  const base = toBaseName(fileName);
  const title = fileName ? `Quiz - ${fileName}` : "Quiz";
  let md = `# ${title}\n\n`;
  if (!questions.length) {
    md += "_No questions available._\n";
    return { fileName: `${base}-quiz.md`, content: md };
  }

  questions.forEach((q, idx) => {
    const letters = lettersFor(q.options.length);
    const correctLetter = letters[q.correctIndex] ?? "?";
    md += `## Question ${idx + 1}\n\n`;
    if (q.sectionTitle) md += `**Section:** ${q.sectionTitle}\n\n`;
    if (typeof q.page === "number") md += `**Page:** ${q.page}\n\n`;
    md += `${q.question}\n\n`;
    q.options.forEach((opt, optionIndex) => {
      md += `- ${letters[optionIndex] ?? "?"}) ${opt}\n`;
    });
    md += `\n**Answer:** ${correctLetter}) ${q.options[q.correctIndex] ?? ""}\n\n`;
    if (q.explanation) md += `**Why:** ${q.explanation}\n\n`;
    md += `> Source: ${q.sourceSnippet}\n\n`;
  });

  return { fileName: `${base}-quiz.md`, content: md.trim() + "\n" };
};
