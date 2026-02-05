import fs from "fs/promises";
import path from "path";

// Base identity prompt - always in English for best AI consistency
const getBaseIdentity = (outputLanguage: string = "en"): string => {
  const languageInstruction = outputLanguage === "en" 
    ? "" 
    : `\n\nCRITICAL: You must output the entire summary in ${getLanguageName(outputLanguage)} language. All headings, content, and explanations must be in ${getLanguageName(outputLanguage)}.`;
    
  return [
    "You are a specialized AI assistant for academic content preparation.",
    "Your only task is to transform complex lecture scripts into highly efficient, exam-oriented summaries.",
    "",
    "Working environment and materials:",
    "1) The guidelines (AI rules) define style, structure and no-gos and have highest priority.",
    "2) The source is a text extract from university slides (60-100 pages).",
    "3) The context: The user wants to store the material in Notion for long-term exam preparation.",
    languageInstruction
  ].filter(Boolean).join("\n");
};

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: "English",
    de: "German",
    es: "Spanish",
    fr: "French",
    it: "Italian"
  };
  return names[code] || "English";
}

// Format contract - always in English
// Note: This is for legacy summary generation. For section-based summaries, see getFormatInstructions("summary") in study-prompts.ts
const getFormatContract = (): string => {
  return [
    "",
    "IMPORTANT - Format contract:",
    "- Output starts DIRECTLY with an H1 heading (# Title).",
    "- NO metadata, NO frontmatter, NO introductory comments.",
    "- Only pure Markdown.",
    "- Never number headings (no '## 1.' / '## I.' etc).",
    "- If math/formulas appear: use LaTeX (inline $...$, Display $$ ... $$) and explain variables directly after."
  ].join("\n");
};

const loadGuidelines = async (): Promise<string> => {
  // Guidelines are always in English for consistency
  const files = [`guidelines/general.en.md`, `guidelines/summary.en.md`];
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

// User prompt with explicit output language instruction
const getSummaryUserPrompt = (outputLanguage: string, text: string, structure?: string): string => {
  const langName = getLanguageName(outputLanguage);
  
  return [
    `Source text (extract from PDF):`,
    text,
    "",
    "Optional structure hints (headings):",
    structure?.trim() ? structure.trim() : "None",
    "",
    `Generate the summary in ${langName} language.`,
    `Output ONLY the finished summary in Markdown starting with # Title.`,
    `All content must be in ${langName}.`
  ].join("\n");
};

const getRefineUserPrompt = (outputLanguage: string, summary: string): string => {
  const langName = getLanguageName(outputLanguage);
  
  return [
    "You revise the existing summary according to the user's instructions.",
    `Maintain the output language: ${langName}.`,
    "Output only the fully updated summary in Markdown.",
    "Start directly with # Title (H1 heading).",
    "",
    "Current summary:",
    summary
  ].join("\n");
};

export const buildSummaryPrompts = async (
  text: string,
  structure?: string,
  outputLanguage: string = "en",
  customGuidelines?: string
) => {
  const guidelines = await loadGuidelines();
  let finalGuidelines = guidelines;
  
  // Append custom guidelines if provided
  if (customGuidelines && customGuidelines.trim().length > 0) {
    finalGuidelines = `${guidelines}\n\n---\n\nAdditional User Guidelines:\n${customGuidelines.trim()}`;
  }
  
  const baseIdentity = getBaseIdentity(outputLanguage);
  const formatContract = getFormatContract();
  
  const systemPrompt = `${baseIdentity}\n\nGuidelines (AI Rules):\n${finalGuidelines}\n\nStrictly follow the guidelines.${formatContract}`;
  const userPrompt = getSummaryUserPrompt(outputLanguage, text, structure);

  return { systemPrompt, userPrompt };
};

export const buildRefineSystemPrompt = async (
  summary: string,
  outputLanguage: string = "en",
  customGuidelines?: string
) => {
  const guidelines = await loadGuidelines();
  let finalGuidelines = guidelines;
  
  // Append custom guidelines if provided
  if (customGuidelines && customGuidelines.trim().length > 0) {
    finalGuidelines = `${guidelines}\n\n---\n\nAdditional User Guidelines:\n${customGuidelines.trim()}`;
  }
  
  const baseIdentity = getBaseIdentity(outputLanguage);
  const formatContract = getFormatContract();
  const userPrompt = getRefineUserPrompt(outputLanguage, summary);
  
  return [
    baseIdentity,
    "",
    "Guidelines (AI Rules):",
    finalGuidelines,
    formatContract,
    "",
    userPrompt
  ].join("\n");
};
