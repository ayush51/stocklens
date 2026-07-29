/**
 * Defuses CSV/spreadsheet formula injection: a cell starting with =, +, @,
 * or a tab/CR (the characters Excel/Sheets treat as a formula trigger) gets
 * a leading apostrophe, exactly like Excel's own "Keep Text" import option
 * — the value is preserved and visible, but never executes if the data is
 * later reopened in a spreadsheet or copy-pasted somewhere that evaluates
 * it.
 *
 * A leading "-" is deliberately NOT always treated as dangerous: a bare
 * negative number ("-500", "-12.5") is ordinary financial data (a
 * withdrawal amount, a fee credit), not a formula — Excel itself parses it
 * as a number, not an expression. Only a "-" followed by something other
 * than a plain number (e.g. "-2+3+cmd|' /c calc'!A0", a real injection
 * payload) gets neutralized.
 *
 * Applied to every raw cell immediately after parsing, before any other
 * processing — defense in depth, not conditional on which field a value
 * ends up mapped to.
 */
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "@", "\t", "\r"]);
const BARE_NEGATIVE_NUMBER = /^-\d+(\.\d+)?$/;

export function neutralizeFormulaInjection(value: string): string {
  if (value.length === 0) return value;
  const first = value[0];

  if (first === "-") {
    return BARE_NEGATIVE_NUMBER.test(value) ? value : `'${value}`;
  }

  return FORMULA_TRIGGER_CHARS.has(first) ? `'${value}` : value;
}
