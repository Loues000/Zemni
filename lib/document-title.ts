const normalizeSpaces = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const prettifyFileBase = (fileBase: string): string => {
  return normalizeSpaces(fileBase.replace(/[_-]+/g, " "));
};

const looksLikePageMarker = (line: string): boolean => {
  return /^(?:page|seite)\s*\d+\b/i.test(line);
};

const looksLikeUrlish = (line: string): boolean => {
  return /https?:\/\//i.test(line) || /www\./i.test(line);
};

const looksLikeTitleCandidate = (line: string): boolean => {
  const trimmed = line.trim();
  if (trimmed.length < 6 || trimmed.length > 90) return false;
  if (looksLikePageMarker(trimmed)) return false;
  if (looksLikeUrlish(trimmed)) return false;
  if (/^[-–—•*·\d\s.()]+$/.test(trimmed)) return false;

  const letters = (trimmed.match(/[A-Za-zÄÖÜäöüß]/g) ?? []).length;
  if (letters < 3) return false;

  const digits = (trimmed.match(/\d/g) ?? []).length;
  if (digits / Math.max(1, trimmed.length) > 0.35) return false;

  return true;
};

const extractHeadingFromMarkdown = (text: string): string | null => {
  const head = text.split("\n").slice(0, 80).join("\n");
  const match = head.match(/^#{1,2}\s+(.+?)\s*$/m);
  if (!match?.[1]) return null;
  const title = normalizeSpaces(match[1]);
  return title.length > 0 ? title : null;
};

const extractLabeledTitle = (text: string): string | null => {
  const head = text.split("\n").slice(0, 120).join("\n");
  const match = head.match(/^(?:title|titel)\s*:\s*(.+?)\s*$/im);
  if (!match?.[1]) return null;
  const title = normalizeSpaces(match[1]);
  return title.length > 0 ? title : null;
};

const extractFirstGoodLine = (text: string): string | null => {
  const lines = text.split("\n").slice(0, 140);
  for (const raw of lines) {
    const cleaned = normalizeSpaces(raw.replace(/^[#>*\-\u2022]+\s*/, ""));
    if (!cleaned) continue;
    if (!looksLikeTitleCandidate(cleaned)) continue;
    return cleaned;
  }
  return null;
};

export const getDocumentTitle = (extractedText: string, fileName: string): string => {
  const fileBase = (fileName || "Dokument").replace(/\.[^.]+$/, "");
  const prettyFallback = prettifyFileBase(fileBase) || "Dokument";
  const text = String(extractedText ?? "");

  return (
    extractHeadingFromMarkdown(text) ||
    extractLabeledTitle(text) ||
    extractFirstGoodLine(text) ||
    prettyFallback
  );
};

