import type { Flashcard, OutputEntry, QuizQuestion } from "@/types";

export const getSummaryTitle = (summary: string, fallback: string): string => {
  const match = summary.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fallback;
};

export const createPdfId = (fileName: string, extractedText: string): string => {
  const content = fileName + ":" + extractedText.slice(0, 1000);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "pdf-" + Math.abs(hash).toString(36);
};

export const flashcardsToMarkdown = (cards: Flashcard[], fileName: string): string => {
  const title = fileName ? `Flashcards - ${fileName}` : "Flashcards";
  const bySection = new Map<string, Flashcard[]>();
  for (const card of cards) {
    const key = card.sectionTitle || card.sectionId || "Document";
    const list = bySection.get(key) ?? [];
    list.push(card);
    bySection.set(key, list);
  }

  let md = `# ${title}\n\n`;
  if (bySection.size === 0) {
    md += "_No flashcards generated._\n";
    return md;
  }

  for (const [sectionLabel, sectionCards] of bySection.entries()) {
    md += `## ${sectionLabel}\n\n`;
    sectionCards.forEach((card, idx) => {
      const typeLabel = card.type === "cloze" ? "Cloze" : "Q/A";
      md += `### ${idx + 1}. ${typeLabel}\n\n`;
      md += `**Front:** ${card.front}\n\n`;
      md += `**Back:** ${card.back}\n\n`;
      md += `> Source: ${card.sourceSnippet}\n\n`;
    });
  }
  return md.trim() + "\n";
};

const lettersFor = (count: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(String.fromCharCode(65 + i));
  }
  return out;
};

export const quizQuestionToMarkdown = (
  question: QuizQuestion,
  revealAnswer: boolean,
  positionLabel: string,
  fileName: string
): string => {
  const title = fileName ? `Quiz - ${fileName}` : "Quiz";
  const sectionLabel = question.page ? `${question.sectionTitle} (Page ${question.page})` : question.sectionTitle;
  const letters = lettersFor(question.options.length);
  let md = `# ${title}\n\n`;
  md += `## ${sectionLabel}\n\n`;
  md += `### ${positionLabel}\n\n`;
  md += `${question.question}\n\n`;
  question.options.forEach((opt, idx) => {
    md += `- ${letters[idx] ?? "?"}) ${opt}\n`;
  });
  if (revealAnswer) {
    const correctLetter = letters[question.correctIndex] ?? "?";
    md += `\n**Answer:** ${correctLetter}) ${question.options[question.correctIndex]}\n\n`;
    if (question.explanation) {
      md += `**Why:** ${question.explanation}\n\n`;
    }
    md += `> Source: ${question.sourceSnippet}\n`;
  } else {
    md += `\n_(Reveal shows the answer.)_\n`;
  }
  return md.trim() + "\n";
};

export const renderQuizPreview = (output: OutputEntry, fileName: string): string => {
  const state = output.quizState;
  if (!state) return "# Quiz\n\nNo quiz session.\n";
  const questions = output.quiz ?? [];
  const currentQuestion = questions[state.questionCursor];
  if (!currentQuestion) return "# Quiz\n\nGenerating questions...\n";

  const positionLabel = `Question ${state.questionCursor + 1} / ${Math.max(1, questions.length)}`;
  return quizQuestionToMarkdown(currentQuestion, Boolean(state.revealAnswer), positionLabel, fileName);
};
