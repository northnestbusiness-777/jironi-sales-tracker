import { Category } from "@/types";

export const normDesc = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").trim();

export interface CatResult {
  categoryId: string | null;
  subTag?: string;
  confidence: number;
  flagged: boolean;
}

/** Department in brackets after S/A, e.g. "Rahman Da S/A (F&B)" */
function deptAfterSA(raw: string): string | undefined {
  const m = raw.match(/\bs\s*\/\s*a\b[\s:.-]*\(([^)]{1,24})\)/i);
  if (m && m[1].trim()) return m[1].trim();
  return undefined;
}

/**
 * Categorization order matters:
 * 1. Remembered correction (exact normalized match)
 * 2. "S/A" salary-advance pattern
 * 3. "C/O" checkout with an alphabetic bracketed platform -> OTA
 * 4. "MD Sir" -> Owner/Director Account
 * 5. "Opening Balance"
 * 6. Keyword scoring against the property's dictionary
 * Anything unmatched -> Uncategorized, flagged for review. Never guessed wildly.
 */
export function categorize(
  rawDesc: string,
  cats: Category[],
  corrections: Record<string, string> = {},
): CatResult {
  const desc = normDesc(rawDesc);
  if (!desc) return { categoryId: null, confidence: 0, flagged: true };

  if (corrections[desc]) {
    return { categoryId: corrections[desc], confidence: 1, flagged: false };
  }

  const findCat = (needle: string) =>
    cats.find((c) => normDesc(c.name).includes(needle));

  // Staff salary advance
  if (/\bs\s*\/\s*a\b/.test(desc) || /salary advance/.test(desc)) {
    const cat = findCat("salary advance");
    return {
      categoryId: cat?.id ?? null,
      subTag: deptAfterSA(rawDesc),
      confidence: 0.95,
      flagged: false,
    };
  }

  // OTA checkout: C/O or C/OUT with a bracketed platform name (letters, not bill numbers)
  const bracket = rawDesc.match(/\(([^)]+)\)/);
  const bracketAlpha =
    bracket && /[a-zA-Z]/.test(bracket[1]) ? bracket[1].trim() : undefined;
  if (/c\s*\/\s*(o|out)\b/.test(desc) && bracketAlpha) {
    const cat = findCat("ota");
    return {
      categoryId: cat?.id ?? null,
      subTag: bracketAlpha,
      confidence: 0.95,
      flagged: false,
    };
  }

  // Owner / director personal account
  if (/md\s*sir/.test(desc)) {
    const cat = findCat("owner");
    return {
      categoryId: cat?.id ?? null,
      subTag: "MD Sir",
      confidence: 0.9,
      flagged: false,
    };
  }

  if (/opening balance/.test(desc)) {
    const cat = findCat("opening balance");
    return { categoryId: cat?.id ?? null, confidence: 1, flagged: false };
  }

  // Keyword scoring
  const scored: { cat: Category; score: number }[] = [];
  for (const c of cats) {
    let score = 0;
    for (const k of c.keywords) {
      const kk = normDesc(k);
      if (!kk) continue;
      if (desc.includes(kk)) score += kk.includes(" ") ? 2 : 1;
    }
    if (score > 0) scored.push({ cat: c, score });
  }
  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { categoryId: null, confidence: 0.25, flagged: true };
  }

  const top = scored[0];
  // Bundled line detection: two different categories both matched strongly
  // (e.g. "BAR SALE (...) RESTAURANT SALE (...)") -> flag for manual split.
  const second = scored[1];
  const bundled =
    second &&
    second.score >= 2 &&
    second.cat.id !== top.cat.id &&
    top.cat.side === second.cat.side;

  return {
    categoryId: top.cat.id,
    confidence: bundled ? 0.5 : top.score >= 2 ? 0.9 : 0.65,
    flagged: bundled || top.score < 2,
  };
}