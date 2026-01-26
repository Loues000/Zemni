import fs from "fs/promises";
import path from "path";
import type { DocumentSection } from "@/types";

const BASE_IDENTITY = [
  "Du bist ein spezialisierter KI-Assistent fuer akademische Aufbereitung.",
  "Deine Aufgabe ist es, aus gegebenem Lernstoff hochwertige, pruefungsorientierte Lernartefakte zu erstellen (Zusammenfassung, Flashcards, Quiz).",
  "Du arbeitest strikt mit dem gelieferten Text und erfindest nichts hinzu.",
  "Ausgabe ist auf Deutsch (englische Fachbegriffe aus dem Skript beibehalten)."
].join("\n");

const GUIDELINES_GENERAL = "guidelines/general.en.md";
const GUIDELINES_SUMMARY = "guidelines/summary.en.md";
const GUIDELINES_FLASHCARDS = "guidelines/flashcards.en.md";
const GUIDELINES_QUIZ = "guidelines/quiz.en.md";

const loadGuidelines = async (files: string[]): Promise<string> => {
  const parts = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(process.cwd(), file);
      try {
        return await fs.readFile(filePath, "utf8");
      } catch {
        return "";
      }
    })
  );

  return parts.filter((p) => p.trim().length > 0).join("\n\n---\n\n");
};

export const buildSectionSummaryPrompts = async (
  sections: DocumentSection[],
  structure?: string
): Promise<{ systemPrompt: string; userPrompt: string }> => {
  const guidelines = await loadGuidelines([GUIDELINES_GENERAL, GUIDELINES_SUMMARY]);
  const systemPrompt = [
    BASE_IDENTITY,
    "",
    "Regelwerk (KI-Vorgaben):",
    guidelines,
    "",
    "Format:",
    "- Ausgabe ist reines Markdown.",
    "- Beginnt direkt mit einer H1 (# Titel).",
    "- Baue eine klare Gliederung mit mehreren H2 (##) und passenden H3 (###), statt einen langen unstrukturierten Block.",
    "- Pro Unterkapitel: 5-10 dichte Bulletpoints + Key Definitions (wenn sinnvoll).",
    "- Ueberschriften niemals nummerieren (kein '## 1.' / '## I.' etc).",
    "- Wenn Mathe/Formeln vorkommen: nutze LaTeX (inline $...$, Display $$ ... $$) und erklaere Variablen direkt danach.",
    "- VERBOTEN: Abschluss-Saetze wie 'Damit kann man sich gut vorbereiten' oder 'Alles kommt aus den Vorlesungsfolien'."
  ].join("\n");

  const serializedSections = sections
    .map((s) => {
      const meta = [`ID: ${s.id}`, `Title: ${s.title}`];
      if (typeof s.page === "number") meta.push(`Page: ${s.page}`);
      return [
        "-----",
        meta.join(" | "),
        "Text:",
        s.text
      ].join("\n");
    })
    .join("\n");

  const userPrompt = [
    "Quelle (Sections):",
    serializedSections,
    "",
    "Optionale Strukturvorgaben (Ueberschriften):",
    structure?.trim() ? structure.trim() : "Keine",
    "",
    "Aufgabe:",
    "- Erstelle eine kompakte, pruefungsorientierte Zusammenfassung mit klarer Gliederung (H2/H3).",
    "- Pro Unterkapitel: 5-10 Bulletpoints (kurz, dicht) + 'Key Definitions' (wenn sinnvoll).",
    "- Keine Metadaten, keine Einleitung, kein Frontmatter.",
    "- Ueberschriften nicht nummerieren.",
    "- VERBOTEN: Abschluss-/Meta-Saetze (z.B. 'Damit kann man sich gut vorbereiten', 'Alles kommt aus den Vorlesungsfolien').",
    "",
    "Beginne direkt mit # Titel."
  ].join("\n");

  return { systemPrompt, userPrompt };
};

export const buildFlashcardsPrompts = async (
  sections: DocumentSection[],
  cardsPerSection: number
): Promise<{ systemPrompt: string; userPrompt: string }> => {
  const guidelines = await loadGuidelines([GUIDELINES_GENERAL, GUIDELINES_FLASHCARDS]);
  const systemPrompt = [
    BASE_IDENTITY,
    "",
    "Regelwerk (KI-Vorgaben):",
    guidelines,
    "",
    "Format:",
    "- Ausgabe ist NUR gueltiges JSON (kein Markdown, keine Codefences).",
    "- Top-Level: {\"flashcards\": Flashcard[]}.",
    "",
    "Kuerze (wichtig fuer Geschwindigkeit):",
    "- front: max 140 Zeichen, keine Schachtelsaetze.",
    "- back: max 280 Zeichen, nur die minimale korrekte Antwort (optional 1 kurzer Zusatzsatz).",
    "- Keine Newlines in Strings (nutze Leerzeichen).",
    "",
    "Flashcard Schema:",
    "- sectionId: string",
    "- sectionTitle: string",
    "- type: \"qa\" | \"cloze\"",
    "- front: string",
    "- back: string",
    "- sourceSnippet: string (kurzes, woertliches Zitat aus dem Section-Text, 1-3 Saetze, max 240 Zeichen)",
    "- page?: number (wenn bekannt)"
  ].join("\n");

  const serializedSections = sections
    .map((s) => {
      const meta = [`ID: ${s.id}`, `Title: ${s.title}`];
      if (typeof s.page === "number") meta.push(`Page: ${s.page}`);
      return [
        "-----",
        meta.join(" | "),
        "Text:",
        s.text
      ].join("\n");
    })
    .join("\n");

  const userPrompt = [
    `Erzeuge bis zu ${cardsPerSection} Flashcards pro Section (Ziel: ${cardsPerSection}).`,
    "Mische Q/A und Cloze sinnvoll (mindestens 1 Cloze pro Section, wenn moeglich).",
    "Wenn du die Zielanzahl nicht sauber/ohne Erfindungen erreichst: lieber weniger, aber hochwertig.",
    "",
    "Quelle (Sections):",
    serializedSections,
    "",
    "WICHTIG:",
    "- sourceSnippet muss ein woertliches Zitat aus dem jeweiligen Section-Text sein.",
    "- Keine doppelten Karten pro Section.",
    "",
    "Gib nur das JSON aus."
  ].join("\n");

  return { systemPrompt, userPrompt };
};

export const buildChunkNotesPrompts = async (
  section: DocumentSection,
  {
    maxBullets = 40
  }: { maxBullets?: number } = {}
): Promise<{ systemPrompt: string; userPrompt: string }> => {
  const guidelines = await loadGuidelines([GUIDELINES_GENERAL, GUIDELINES_SUMMARY]);
  const systemPrompt = [
    BASE_IDENTITY,
    "",
    "Regelwerk (KI-Vorgaben):",
    guidelines,
    "",
    "Format:",
    "- Ausgabe ist reines Markdown.",
    "- KEINE H1/H2/H3 Ueberschriften, KEINE Nummerierung.",
    "- Nur dichte Bulletpoints ('- ...'), keine Einleitung, keine Abschlusssaetze."
  ].join("\n");

  const meta = [`ID: ${section.id}`, `Title: ${section.title}`];
  if (typeof section.page === "number") meta.push(`Page: ${section.page}`);

  const userPrompt = [
    "Quelle:",
    "-----",
    meta.join(" | "),
    "Text:",
    section.text,
    "",
    "Aufgabe:",
    `- Extrahiere die wichtigsten Lernpunkte als maximal ${Math.max(10, Math.floor(maxBullets))} Bulletpoints.`,
    "- Fokus: Definitionen, Abgrenzungen, Mechanismen, Bedingungen, Trade-offs, Formeln + Variablen.",
    "- Nur Inhalte aus dem Text, nichts erfinden."
  ].join("\n");

  return { systemPrompt, userPrompt };
};

export const buildQuizPrompts = async (
  section: DocumentSection,
  questionsCount: number,
  avoidQuestions: string[]
): Promise<{ systemPrompt: string; userPrompt: string }> => {
  const guidelines = await loadGuidelines([GUIDELINES_GENERAL, GUIDELINES_QUIZ]);
  const systemPrompt = [
    BASE_IDENTITY,
    "",
    "Regelwerk (KI-Vorgaben):",
    guidelines,
    "",
    "Format:",
    "- Ausgabe ist NUR gueltiges JSON (kein Markdown, keine Codefences).",
    "- Top-Level: {\"questions\": QuizQuestion[]}.",
    "",
    "QuizQuestion Schema:",
    "- sectionId: string",
    "- sectionTitle: string",
    "- question: string",
    "- options: string[4]",
    "- correctIndex: number (0..3)",
    "- explanation: string (kurz, 1-2 Saetze)",
    "- sourceSnippet: string (kurzes, woertliches Zitat aus dem Section-Text, max 240 Zeichen)",
    "- page?: number (wenn bekannt)"
  ].join("\n");

  const meta = [`ID: ${section.id}`, `Title: ${section.title}`];
  if (typeof section.page === "number") meta.push(`Page: ${section.page}`);

  const userPrompt = [
    `Erzeuge exakt ${questionsCount} Multiple-Choice Fragen (4 Optionen) fuer diese Section.`,
    "Distractors muessen aus Begriffen/Ideen derselben Section kommen (keine externen Facts).",
    "",
    "Vermeide Wiederholungen:",
    avoidQuestions.length > 0 ? avoidQuestions.map((q) => `- ${q}`).join("\n") : "- (keine)",
    "",
    "Section:",
    "-----",
    meta.join(" | "),
    "Text:",
    section.text,
    "",
    "WICHTIG:",
    "- sourceSnippet muss ein woertliches Zitat aus dem Section-Text sein.",
    "- correctIndex muss zur richtigen Option passen.",
    "",
    "Gib nur das JSON aus."
  ].join("\n");

  return { systemPrompt, userPrompt };
};
