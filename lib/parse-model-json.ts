const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
};

const sanitizeJsonText = (text: string): string => {
  let inString = false;
  let escape = false;
  let out = "";
  let stringStart = -1;

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
      stringStart = i;
      out += ch;
      continue;
    }

    out += ch;
  }

  // Handle unterminated strings: if we're still in a string at the end, close it
  if (inString && stringStart >= 0) {
    // If we ended while escaping, complete the escape sequence first
    if (escape) {
      out += "\\"; // Add the incomplete escape
    }
    // Close the string
    out += "\"";
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

/**
 * Attempts to fix common JSON issues before parsing
 */
const attemptJsonFix = (text: string): string => {
  let fixed = text.trim();

  // Remove trailing commas before closing braces/brackets
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

  // Fix unescaped newlines in strings (basic heuristic)
  // This is a fallback - sanitizeJsonText should handle most cases
  fixed = fixed.replace(/([^\\])"([^"]*)\n([^"]*)"([^,}\]]*)/g, (match, before, part1, part2, after) => {
    // Only fix if it looks like it's inside a string value (not a key)
    if (before.match(/[:{[]\s*$/)) {
      return `${before}"${part1}\\n${part2}"${after}`;
    }
    return match;
  });

  return fixed;
};

/**
 * Attempts to salvage partial data from a truncated JSON array
 */
const attemptPartialJsonRecovery = (text: string): { data: any; recovered: boolean } => {
  const trimmed = text.trim();

  // Strategy 1: Find the last completed object in an array
  const lastClosedBrace = trimmed.lastIndexOf("}");
  const lastOpenBracket = trimmed.lastIndexOf("[");

  if (lastClosedBrace > lastOpenBracket && lastOpenBracket !== -1) {
    let candidate = trimmed.slice(0, lastClosedBrace + 1);

    // Count open braces and brackets to see what's missing
    let openBraces = 0;
    let openBrackets = 0;
    for (const char of candidate) {
      if (char === "{") openBraces++;
      if (char === "}") openBraces--;
      if (char === "[") openBrackets++;
      if (char === "]") openBrackets--;
    }

    // Safety: don't add more than a few closing tokens
    if (openBrackets > 0) candidate += "]".repeat(openBrackets);
    if (openBraces > 0) candidate += "}".repeat(openBraces);

    try {
      const parsed = JSON.parse(candidate);
      return { data: parsed, recovered: true };
    } catch (e) {
      // Continue to next strategy
    }
  }

  // Strategy 2: Look for array patterns like "flashcards": [...]
  // Try to find complete objects and reconstruct the array
  const arrayMatch = trimmed.match(/"(\w+)"\s*:\s*\[/);
  if (arrayMatch) {
    const arrayKey = arrayMatch[1];
    const arrayStart = trimmed.indexOf("[", arrayMatch.index);
    
    if (arrayStart !== -1) {
      // Find all complete objects in the array
      const content = trimmed.slice(arrayStart + 1);
      const objectMatches = content.match(/\{[^{}]*\}/g);
      
      if (objectMatches && objectMatches.length > 0) {
        try {
          const objects = objectMatches.map(obj => JSON.parse(obj));
          const reconstructed = { [arrayKey]: objects };
          return { data: reconstructed, recovered: true };
        } catch (e) {
          // Continue to next strategy
        }
      }
    }
  }

  // Strategy 3: Try to find any complete JSON objects at all
  const objectMatches = trimmed.match(/\{[^{}]*\}/g);
  if (objectMatches && objectMatches.length > 0) {
    for (let i = objectMatches.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(objectMatches[i]);
        return { data: parsed, recovered: true };
      } catch (e) {
        continue;
      }
    }
  }

  return { data: null, recovered: false };
};

export const parseJsonFromModelText = <T>(text: string): T => {
  if (typeof text !== "string") {
    throw new Error(`Invalid input: expected string, got ${typeof text}`);
  }
  if (text.trim().length === 0) {
    throw new Error("Invalid input: expected non-empty string, got empty string");
  }

  const noFences = stripCodeFences(text);
  let extracted = extractFirstJsonValue(noFences) ?? sliceLikelyJson(noFences);
  let sliced = sanitizeJsonText(extracted);

  if (!sliced || sliced.trim().length === 0) {
    const originalPreview = text.length > 200 ? text.slice(0, 200) + "..." : text;
    throw new Error(
      `No JSON structure found in model response. Original text (${text.length} chars): ${originalPreview || "(empty)"}`
    );
  }

  // Try parsing with the sanitized text
  try {
    return JSON.parse(sliced) as T;
  } catch (firstErr) {
    // If first attempt fails, check if it's truncated and try recovery
    const recovery = attemptPartialJsonRecovery(sliced);
    if (recovery.recovered) {
      console.warn("[JSON Recovery] Successfully recovered partial data from truncated response");
      return recovery.data as T;
    }

    // If recovery failed, try with additional fixes
    try {
      const fixed = attemptJsonFix(sliced);
      return JSON.parse(fixed) as T;
    } catch (secondErr) {
      // If both attempts fail, provide detailed error
      const preview = sliced.length > 400 ? sliced.slice(0, 400) + "..." : sliced;
      const originalLength = text.length;
      const slicedLength = sliced.length;
      const errorMessage = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const isTruncated = errorMessage.includes("Expected ',' or ']'") ||
        errorMessage.includes("unexpected character at line") ||
        errorMessage.includes("Unexpected end of JSON input");

      const originalPreview = text.length > 200 ? text.slice(0, 200) + "..." : text;
      throw new Error(
        `Invalid JSON from model${isTruncated ? " (Looks truncated)" : ""}. Original length: ${originalLength}, Sliced length: ${slicedLength}. ` +
        `Parse error: ${errorMessage}. ` +
        `Original preview: ${originalPreview || "(empty)"}. ` +
        `Sliced preview: ${preview || "(empty)"}`
      );
    }
  }
};
