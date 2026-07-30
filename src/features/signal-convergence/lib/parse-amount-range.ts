export interface AmountRange {
  min: number | null;
  max: number | null;
}

/**
 * House/Senate Periodic Transaction Reports disclose value as a bucketed
 * range, not an exact figure (e.g. "$1,001 - $15,000") — this parses the
 * real, standardized STOCK Act range vocabulary. Pure and deterministic
 * (instructions.md §11). Returns {min: null, max: null} for unrecognized
 * text rather than guessing a number.
 */
export function parseAmountRange(rawText: string): AmountRange {
  const text = rawText.trim();

  const overMatch = text.match(/^Over\s+\$?([\d,]+)/i);
  if (overMatch) {
    return { min: parseNumber(overMatch[1]), max: null };
  }

  // Handles "$1,001 - $15,000", "$1,001–$15,000" (en dash), "$1,001 to $15,000".
  const rangeMatch = text.match(/\$?([\d,]+)\s*(?:-|–|—|to)\s*\$?([\d,]+)/i);
  if (rangeMatch) {
    return { min: parseNumber(rangeMatch[1]), max: parseNumber(rangeMatch[2]) };
  }

  const singleMatch = text.match(/^\$?([\d,]+)$/);
  if (singleMatch) {
    const value = parseNumber(singleMatch[1]);
    return { min: value, max: value };
  }

  return { min: null, max: null };
}

function parseNumber(value: string): number | null {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Explicitly marked as an estimate everywhere it's used — a range midpoint
 * is not a real reported value, just the arithmetic center of the
 * disclosed bucket. Null when either bound is missing (an open-ended
 * "Over $X" range has no meaningful midpoint).
 */
export function estimateRangeMidpoint(range: AmountRange): number | null {
  if (range.min === null || range.max === null) return null;
  return (range.min + range.max) / 2;
}
