export interface GlossaryEntry {
  term: string;
  definition: string;
  /** Plain-English directional guidance — what higher/lower generally signals, and the honest caveat. */
  impact: string;
}

/**
 * Starts with the ratios panel's fields — the highest-traffic terms for
 * someone new to reading financials. Extend as more terms show up in KPI
 * templates/thesis fields; this is intentionally not a complete financial
 * dictionary on day one.
 */
export const GLOSSARY = {
  peRatioTrailing: {
    term: "P/E Ratio (trailing)",
    definition:
      "Share price divided by earnings per share over the last 12 months. Shows how much investors are paying for each dollar of past profit.",
    impact:
      "Higher usually means the market expects faster future growth (or the stock is simply expensive). Lower can mean a bargain — or that the market doubts future growth. Only meaningful compared to similar companies or the same company's own history.",
  },
  peRatioForward: {
    term: "P/E Ratio (forward)",
    definition:
      "Same idea as trailing P/E, but using analysts' estimated earnings for the next 12 months instead of the last 12.",
    impact:
      "Lower than the trailing P/E usually signals expected earnings growth. Higher than trailing can signal an expected earnings decline. Depends on analyst estimates being roughly right, which they often aren't.",
  },
  priceToBook: {
    term: "Price-to-Book (P/B)",
    definition: "Share price divided by the company's net asset value (assets minus liabilities) per share.",
    impact:
      "Under 1 can mean the market values the company below its accounting net worth — sometimes a bargain, sometimes a warning sign. High P/B is normal for asset-light, high-growth companies (software) and less normal for capital-heavy ones (banks, industrials).",
  },
  beta: {
    term: "Beta",
    definition:
      "How much a stock's price tends to move relative to the overall market. 1.0 moves with the market; above 1 is more volatile, below 1 is less.",
    impact:
      "Higher beta means bigger swings both up and down — more risk, more potential reward. Useful for sizing a position relative to how much volatility you can tolerate.",
  },
  dividendYieldTtm: {
    term: "Dividend Yield (TTM)",
    definition: "Dividends paid per share over the trailing 12 months, divided by the current share price.",
    impact:
      "Higher yield means more cash income relative to price — but an unusually high yield can also mean the market expects a dividend cut, or the price has already fallen sharply.",
  },
  week52High: {
    term: "52-Week High",
    definition: "The highest price the stock has traded at over the last year.",
    impact:
      "How far the current price sits below this high is a common momentum gauge — near the high suggests strength, well below can mean a pullback (good or bad, depending on why).",
  },
  week52Low: {
    term: "52-Week Low",
    definition: "The lowest price the stock has traded at over the last year.",
    impact:
      "A price near the 52-week low can signal either a value opportunity or a deteriorating business — the reason behind the drop matters more than the number itself.",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryTermKey = keyof typeof GLOSSARY;
