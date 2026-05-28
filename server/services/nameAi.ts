const SEPARATORS = /[._-]+/;

const COMMON_WORDS = new Set([
  "official",
  "real",
  "the",
  "shop",
  "store",
  "co",
  "hq",
  "team",
  "studio",
  "media",
  "marketing",
  "digital",
  "agency",
  "brand",
  "life",
  "daily",
  "world",
  "global",
  "mx",
  "es",
  "usa",
]);

export interface ParsedName {
  firstName: string | null;
  lastName: string | null;
  confidence: "high" | "medium" | "low";
}

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function cleanToken(token: string): string | null {
  const cleaned = token.replace(/\d+/g, "").trim();
  if (cleaned.length < 2 || COMMON_WORDS.has(cleaned.toLowerCase())) return null;
  return capitalize(cleaned);
}

/** Infers first/last name from Instagram-style username (NameAI-style heuristic). */
export function parseNameFromUsername(username: string): ParsedName {
  const handle = username.replace(/^@/, "").trim();
  if (!handle) return { firstName: null, lastName: null, confidence: "low" };

  const parts = handle
    .split(SEPARATORS)
    .flatMap((p) => {
      const camel = p.replace(/([a-z])([A-Z])/g, "$1 $2");
      return camel.split(/\s+/);
    })
    .map(cleanToken)
    .filter((p): p is string => Boolean(p));

  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
      confidence: "high",
    };
  }

  if (parts.length === 1 && parts[0].length >= 4) {
    return { firstName: parts[0], lastName: null, confidence: "medium" };
  }

  return { firstName: null, lastName: null, confidence: "low" };
}

export function mergeWithFullName(
  parsed: ParsedName,
  fullName: string | null | undefined
): ParsedName {
  if (!fullName?.trim()) return parsed;
  const bits = fullName.trim().split(/\s+/).filter(Boolean);
  if (bits.length >= 2) {
    return {
      firstName: capitalize(bits[0]),
      lastName: bits.slice(1).map(capitalize).join(" "),
      confidence: "high",
    };
  }
  if (bits.length === 1 && !parsed.firstName) {
    return { firstName: capitalize(bits[0]), lastName: parsed.lastName, confidence: "high" };
  }
  return parsed;
}
