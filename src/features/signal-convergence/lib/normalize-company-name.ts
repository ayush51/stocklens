/**
 * Strips common legal-entity suffixes and punctuation so "LOCKHEED MARTIN
 * CORPORATION" and "Lockheed Martin Corp." normalize to the same key.
 * Pure and deterministic (instructions.md §11) — used for both storing
 * and looking up entity-resolution matches, never for display.
 */
const LEGAL_SUFFIXES = [
  "corporation",
  "corp",
  "incorporated",
  "inc",
  "company",
  "co",
  "llc",
  "l l c",
  "ltd",
  "limited",
  "plc",
  "lp",
  "l p",
];

export function normalizeCompanyName(rawName: string): string {
  let name = rawName
    .toLowerCase()
    .replace(/[.,'"()]/g, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();

  // Strip a leading "the" ("The Boeing Company" -> "Boeing Company") and
  // trailing legal-suffix tokens, repeatedly — "corp" then a leftover
  // leading "the" both collapse away either way.
  let changed = true;
  while (changed) {
    changed = false;
    const withoutLeadingThe = name.replace(/^the\s+/, "");
    if (withoutLeadingThe !== name) {
      name = withoutLeadingThe;
      changed = true;
    }
    for (const suffix of LEGAL_SUFFIXES) {
      const pattern = new RegExp(`(^|\\s)${suffix}$`);
      if (pattern.test(name)) {
        name = name.replace(pattern, "").trim();
        changed = true;
      }
    }
  }

  return name;
}
