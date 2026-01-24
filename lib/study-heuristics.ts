export type CoverageLevel = 1 | 2 | 3;

export const estimateFlashcardsPerSection = (totalChars: number, coverageLevel: CoverageLevel): number => {
  const estimated =
    totalChars < 4_000 ? 8 :
    totalChars < 15_000 ? 12 :
    18;

  const factor = coverageLevel === 1 ? 0.6 : coverageLevel === 3 ? 1.5 : 1;
  return Math.max(1, Math.round(estimated * factor));
};

export const estimateQuizQuestions = (totalChars: number): number => {
  // Quiz questions typically require more text per question than flashcards
  // Estimate based on document length
  const estimated =
    totalChars < 3_000 ? 4 :
    totalChars < 8_000 ? 6 :
    totalChars < 20_000 ? 10 :
    totalChars < 50_000 ? 15 :
    20;
  
  return Math.max(1, estimated);
};
