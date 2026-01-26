/**
 * Trims text to fit within a maximum character limit, preserving head and tail.
 * Used for model input preparation.
 */
export const trimForModel = (text: string, maxChars: number): string => {
  const normalized = (text ?? "").trim();
  if (normalized.length <= maxChars) return normalized;
  const headSize = Math.floor(maxChars * 0.7);
  const tailSize = Math.max(0, maxChars - headSize);
  const head = normalized.slice(0, headSize).trim();
  const tail = normalized.slice(Math.max(0, normalized.length - tailSize)).trim();
  return `${head}\n\n...\n\n${tail}`;
};
