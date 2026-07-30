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
  marketCap: {
    term: "Market Cap",
    definition: "Total value of all outstanding shares — share price times shares outstanding.",
    impact:
      "The standard measure of company size, used to compare a company against its own history or against peers. Doesn't account for debt, unlike enterprise value.",
  },
  enterpriseValue: {
    term: "Enterprise Value (EV)",
    definition:
      "Market cap plus debt, minus cash — an estimate of what it would cost to acquire the whole company outright, debt included.",
    impact:
      "Two companies can have the same market cap but very different EV if one carries much more debt. EV is the more complete size measure for that reason, and is what EV/EBITDA and EV/Revenue are built on.",
  },
  evToEbitdaTtm: {
    term: "EV/EBITDA (trailing)",
    definition:
      "Enterprise value divided by trailing-12-month EBITDA (earnings before interest, taxes, depreciation, and amortization).",
    impact:
      "A capital-structure-neutral alternative to P/E — useful for comparing companies with different debt loads. Lower generally means cheaper relative to cash-generating ability, but capital-intensive industries (utilities, telecom) normally trade at lower multiples than asset-light ones, so only compare within the same industry.",
  },
  priceToFcfTtm: {
    term: "Price/FCF (trailing)",
    definition: "Share price divided by trailing-12-month free cash flow per share.",
    impact:
      "Harder to game with accounting choices than P/E, since it's based on actual cash generated. A company trading at a much higher P/FCF than P/E may be reporting net income that isn't backed by real cash — worth a closer look.",
  },
  pegRatioTtm: {
    term: "PEG Ratio (trailing)",
    definition: "Trailing P/E divided by trailing EPS growth rate — a growth-adjusted P/E.",
    impact:
      "A rule-of-thumb popularized by Peter Lynch: PEG near 1 is considered fairly priced relative to growth, below 1 potentially undervalued, above 1 potentially overvalued relative to its own growth. Trailing growth isn't necessarily indicative of future growth, so treat this as one input, not a verdict.",
  },
  operatingIncome: {
    term: "Operating Income",
    definition:
      "Profit from the core business — revenue minus the costs of actually running it (cost of goods, R&D, sales, admin) — before interest and taxes.",
    impact:
      "Higher operating margin (operating income / revenue) generally means a more efficient, scalable business. Falling operating margin while revenue grows can signal rising costs eating into profitability even as the top line looks healthy.",
  },
  freeCashFlow: {
    term: "Free Cash Flow (FCF)",
    definition:
      "Cash generated by the business after paying for the equipment/infrastructure needed to run it (operating cash flow minus capital expenditures).",
    impact:
      "Unlike net income, FCF is hard to distort with accounting choices — it's the actual cash left over to pay dividends, buy back stock, pay down debt, or reinvest. A company with strong net income but weak FCF is worth a closer look at why.",
  },
  stockBasedCompensation: {
    term: "Stock-Based Compensation (SBC)",
    definition: "The value of stock/options granted to employees as pay, expensed against earnings.",
    impact:
      "SBC doesn't cost cash directly, but it dilutes existing shareholders' ownership over time. A company where SBC is large relative to free cash flow is effectively paying a meaningful part of its workforce by diluting you, not just its own cash.",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryTermKey = keyof typeof GLOSSARY;
