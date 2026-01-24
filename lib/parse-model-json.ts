const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
};

const sanitizeJsonText = (text: string): string => {
  let inString = false;
  let escape = false;
  let out = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";

    if (inString) {
      if (escape) {
        escape = false;
        out += ch;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        out += ch;
        continue;
      }
      if (ch === "\"") {
        inString = false;
        out += ch;
        continue;
      }

      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      if (ch === "\u2028") {
        out += "\\u2028";
        continue;
      }
      if (ch === "\u2029") {
        out += "\\u2029";
        continue;
      }

      out += ch;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      out += ch;
      continue;
    }

    out += ch;
  }

  return out;
};

const extractFirstJsonValue = (text: string): string | null => {
  const trimmed = text.trim();
  let start = -1;
  let inString = false;
  let escape = false;
  const stack: Array<"{" | "["> = [];

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i] ?? "";

    if (start === -1) {
      if (ch === "{" || ch === "[") {
        start = i;
        stack.push(ch as "{" | "[");
      }
      continue;
    }

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch as "{" | "[");
      continue;
    }

    if (ch === "}" || ch === "]") {
      const opener = stack.pop();
      const ok =
        (opener === "{" && ch === "}") ||
        (opener === "[" && ch === "]");
      if (!ok) return null;
      if (stack.length === 0) {
        return trimmed.slice(start, i + 1);
      }
    }
  }

  return null;
};

const sliceLikelyJson = (text: string): string => {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const startCandidates = [firstBrace, firstBracket].filter((n) => n >= 0);
  if (startCandidates.length === 0) return trimmed;
  const start = Math.min(...startCandidates);

  const lastBrace = trimmed.lastIndexOf("}");
  const lastBracket = trimmed.lastIndexOf("]");
  const endCandidates = [lastBrace, lastBracket].filter((n) => n >= 0);
  const end = Math.max(...endCandidates);
  if (end <= start) return trimmed.slice(start);

  return trimmed.slice(start, end + 1);
};

export const parseJsonFromModelText = <T>(text: string): T => {
  if (typeof text !== "string") {
    throw new Error(`Invalid input: expected string, got ${typeof text}`);
  }
  if (text.trim().length === 0) {
    throw new Error("Invalid input: expected non-empty string, got empty string");
  }

  const noFences = stripCodeFences(text);
  const extracted = extractFirstJsonValue(noFences) ?? sliceLikelyJson(noFences);
  const sliced = sanitizeJsonText(extracted);
  
  if (!sliced || sliced.trim().length === 0) {
    const originalPreview = text.length > 200 ? text.slice(0, 200) + "..." : text;
    throw new Error(
      `No JSON structure found in model response. Original text (${text.length} chars): ${originalPreview || "(empty)"}`
    );
  }

  try {
    return JSON.parse(sliced) as T;
  } catch (err) {
    const preview = sliced.length > 400 ? sliced.slice(0, 400) + "..." : sliced;
    const originalLength = text.length;
    const slicedLength = sliced.length;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const originalPreview = text.length > 200 ? text.slice(0, 200) + "..." : text;
    throw new Error(
      `Invalid JSON from model. Original length: ${originalLength}, Sliced length: ${slicedLength}. ` +
      `Parse error: ${errorMessage}. ` +
      `Original preview: ${originalPreview || "(empty)"}. ` +
      `Sliced preview: ${preview || "(empty)"}`
    );
  }
};
