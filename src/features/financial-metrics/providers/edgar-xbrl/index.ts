import { AppError } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { recordProviderCall } from "@/lib/provider-log";
import type { FinancialStatementSummary, MetricsProvider } from "@/shared/contracts/metrics-provider";

const SEC_USER_AGENT = "StockLens research@stocklens.app";

// XBRL tag names vary across companies for the same real-world concept
// (e.g. revenue reporting changed with ASC 606 adoption). Try each
// candidate in order; the first with any usable data wins — concepts are
// not mixed within a single metric.
const CONCEPT_CANDIDATES: Record<string, string[]> = {
  revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
  netIncome: ["NetIncomeLoss"],
  grossProfit: ["GrossProfit"],
  eps: ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"],
  totalAssets: ["Assets"],
  totalLiabilities: ["Liabilities"],
  operatingIncome: ["OperatingIncomeLoss"],
  operatingCashFlow: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  // Verified live (2026-07-30): NVDA stopped reporting under
  // "PaymentsToAcquirePropertyPlantAndEquipment" after fiscal 2020 (the
  // tag still exists in its historical facts, which is why a naive
  // "does this tag exist" check passes, but has zero entries after
  // 2020) and now reports capex under "PaymentsToAcquireProductiveAssets"
  // instead — a real tag migration, not a guess.
  capitalExpenditures: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  cashAndEquivalents: [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
  ],
  stockBasedCompensation: ["ShareBasedCompensation"],
  // Verified live (2026-07-29): NVDA reports "PaymentsOfDividends", ORCL
  // reports "PaymentsOfDividendsCommonStock" — real reporting variation,
  // not a guess at possible tag names.
  dividendsPaid: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
  buybacks: ["PaymentsForRepurchaseOfCommonStock"],
  dilutedSharesOutstanding: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
};

interface XbrlFactEntry {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
}

interface XbrlConcept {
  units: Record<string, XbrlFactEntry[]>;
}

interface XbrlCompanyFacts {
  entityName: string;
  facts?: { "us-gaap"?: Record<string, XbrlConcept> };
}

function durationDays(start: string | undefined, end: string): number | null {
  if (!start) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Filters out the year-to-date cumulative duplicate that EDGAR reports
 * alongside the single-quarter value for the same (fy, fp) pair — both
 * share the same fy/fp, distinguished only by how long a span they cover.
 * Point-in-time concepts (balance sheet: Assets, Liabilities) have no
 * `start` at all and need no such filtering.
 *
 * `allowCumulative` widens this for cash-flow-statement concepts: verified
 * live (2026-07-30) that many companies (e.g. NVDA's capex, under either
 * tag name) report Q2–Q4 cash-flow figures as year-to-date cumulative
 * totals rather than a standalone quarter — a real SEC reporting
 * convention for cash-flow items, unlike income-statement concepts
 * (revenue, netIncome, eps), which reliably report discrete quarters. When
 * true, entries longer than a single quarter (up to a full year) are
 * accepted rather than silently discarded as null.
 */
function isUsablePeriodEntry(entry: XbrlFactEntry, allowCumulative: boolean): boolean {
  if (!entry.fy || !entry.fp) return false;
  if (!["10-K", "10-Q"].includes(entry.form)) return false;

  const days = durationDays(entry.start, entry.end);
  if (days === null) return true; // instant concept, no duration to validate
  if (entry.fp === "FY") return days >= 340 && days <= 380;
  if (days >= 75 && days <= 100) return true; // single quarter
  return allowCumulative && days > 100 && days <= 380; // YTD cumulative through this quarter
}

function getUnitEntries(concept: XbrlConcept, preferredUnit: string): XbrlFactEntry[] {
  if (concept.units[preferredUnit]) return concept.units[preferredUnit];
  const firstKey = Object.keys(concept.units)[0];
  return firstKey ? concept.units[firstKey] : [];
}

/**
 * Candidates are tried in order, but — unlike a simple "first candidate
 * with any data wins" — every candidate gets to fill in whichever periods
 * the earlier ones left uncovered. This matters because a candidate list
 * isn't just "different tags different companies use for the same
 * concept"; verified live (2026-07-30) that NVDA's own capex tag changed
 * over time (retired "PaymentsToAcquirePropertyPlantAndEquipment" after
 * fiscal 2020, switched to "PaymentsToAcquireProductiveAssets"). The old
 * tag still has real, usable entries — just only for old periods — so a
 * naive break-on-first-match would lock in the old tag and never look at
 * the new one for any recent period.
 *
 * Within the same tag, a later-filed entry always wins for a given period
 * (restatement preference) except a YTD-cumulative entry never regresses
 * an already-found discrete-quarter one. Across tags, the first tag to
 * cover a period wins that period, except a later tag's discrete entry
 * may still upgrade an earlier tag's cumulative one for the same period.
 */
function extractPeriodValues(
  usGaap: Record<string, XbrlConcept>,
  conceptNames: string[],
  preferredUnit: string,
  allowCumulative: boolean,
): Map<string, number> {
  const byPeriod = new Map<string, { val: number; discrete: boolean; candidateIndex: number }>();

  conceptNames.forEach((conceptName, candidateIndex) => {
    const concept = usGaap[conceptName];
    if (!concept) return;

    for (const entry of getUnitEntries(concept, preferredUnit)) {
      if (!isUsablePeriodEntry(entry, allowCumulative)) continue;

      const days = durationDays(entry.start, entry.end);
      const discrete = days === null || entry.fp === "FY" || (days >= 75 && days <= 100);
      const key = `${entry.fy}-${entry.fp}`;
      const existing = byPeriod.get(key);

      if (existing) {
        if (existing.candidateIndex === candidateIndex) {
          if (existing.discrete && !discrete) continue; // same tag: never let cumulative regress an already-found discrete value
        } else {
          if (existing.discrete || !discrete) continue; // different tag: first to cover this period wins, unless upgrading cumulative -> discrete
        }
      }
      byPeriod.set(key, { val: entry.val, discrete, candidateIndex });
    }
  });

  return new Map([...byPeriod].map(([key, { val }]) => [key, val]));
}

// Cash-flow-statement concepts commonly report Q2–Q4 as YTD cumulative
// (see isUsablePeriodEntry doc above); income-statement and balance-sheet
// concepts reliably report discrete quarters and should stay strict.
const CUMULATIVE_ALLOWED_FIELDS = new Set<keyof typeof CONCEPT_CANDIDATES>([
  "operatingCashFlow",
  "capitalExpenditures",
  "stockBasedCompensation",
  "dividendsPaid",
  "buybacks",
]);

async function fetchCompanyFacts(cik: string): Promise<XbrlCompanyFacts> {
  const startedAt = Date.now();
  const response = await fetchWithTimeout(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    { headers: { "User-Agent": SEC_USER_AGENT }, next: { revalidate: 60 * 60 * 24 } },
    15_000, // can be a multi-MB payload for companies with a long filing history
  );

  if (!response.ok) {
    recordProviderCall({
      provider: "edgar-xbrl",
      operation: "companyfacts",
      durationMs: Date.now() - startedAt,
      status: "ERROR",
      errorCategory: `http_${response.status}`,
      rateLimited: response.status === 429,
    });
    throw new AppError("UPSTREAM_UNAVAILABLE", "Could not reach SEC EDGAR to fetch financial statements.");
  }

  recordProviderCall({
    provider: "edgar-xbrl",
    operation: "companyfacts",
    durationMs: Date.now() - startedAt,
    status: "SUCCESS",
  });
  return response.json() as Promise<XbrlCompanyFacts>;
}

// (field name, XBRL unit) — everything is plain USD except eps and diluted
// share count, which XBRL reports in their own units.
const FIELD_UNITS: [keyof typeof CONCEPT_CANDIDATES, string][] = [
  ["revenue", "USD"],
  ["netIncome", "USD"],
  ["grossProfit", "USD"],
  ["eps", "USD/shares"],
  ["totalAssets", "USD"],
  ["totalLiabilities", "USD"],
  ["operatingIncome", "USD"],
  ["operatingCashFlow", "USD"],
  ["capitalExpenditures", "USD"],
  ["cashAndEquivalents", "USD"],
  ["stockBasedCompensation", "USD"],
  ["dividendsPaid", "USD"],
  ["buybacks", "USD"],
  ["dilutedSharesOutstanding", "shares"],
];

export const edgarXbrlMetricsProvider: MetricsProvider = {
  async getFinancialStatements(cik, opts) {
    const facts = await fetchCompanyFacts(cik);
    const usGaap = facts.facts?.["us-gaap"];
    if (!usGaap) return [];

    const values = new Map(
      FIELD_UNITS.map(([field, unit]) => [
        field,
        extractPeriodValues(usGaap, CONCEPT_CANDIDATES[field], unit, CUMULATIVE_ALLOWED_FIELDS.has(field)),
      ]),
    );

    const allKeys = new Set(FIELD_UNITS.flatMap(([field]) => [...values.get(field)!.keys()]));

    const sourceUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    const periodOrder = { FY: 4, Q4: 3, Q3: 2, Q2: 1, Q1: 0 } as const;

    const statements: FinancialStatementSummary[] = Array.from(allKeys).map((key) => {
      const [fyStr, fp] = key.split("-");
      const get = (field: keyof typeof CONCEPT_CANDIDATES) => {
        const v = values.get(field)!.get(key);
        return v !== undefined ? String(v) : null;
      };
      return {
        fiscalYear: Number(fyStr),
        fiscalPeriod: fp as FinancialStatementSummary["fiscalPeriod"],
        revenue: get("revenue"),
        netIncome: get("netIncome"),
        grossProfit: get("grossProfit"),
        eps: get("eps"),
        totalAssets: get("totalAssets"),
        totalLiabilities: get("totalLiabilities"),
        operatingIncome: get("operatingIncome"),
        operatingCashFlow: get("operatingCashFlow"),
        capitalExpenditures: get("capitalExpenditures"),
        cashAndEquivalents: get("cashAndEquivalents"),
        stockBasedCompensation: get("stockBasedCompensation"),
        dividendsPaid: get("dividendsPaid"),
        buybacks: get("buybacks"),
        dilutedSharesOutstanding: get("dilutedSharesOutstanding"),
        sourceUrl,
      };
    });

    statements.sort((a, b) => {
      if (a.fiscalYear !== b.fiscalYear) return b.fiscalYear - a.fiscalYear;
      return (
        periodOrder[b.fiscalPeriod as keyof typeof periodOrder] -
        periodOrder[a.fiscalPeriod as keyof typeof periodOrder]
      );
    });

    return opts?.limit ? statements.slice(0, opts.limit) : statements;
  },
};
