import { AppError } from "@/lib/errors";
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
 */
function isUsablePeriodEntry(entry: XbrlFactEntry): boolean {
  if (!entry.fy || !entry.fp) return false;
  if (!["10-K", "10-Q"].includes(entry.form)) return false;

  const days = durationDays(entry.start, entry.end);
  if (days === null) return true; // instant concept, no duration to validate
  if (entry.fp === "FY") return days >= 340 && days <= 380;
  return days >= 75 && days <= 100; // single quarter, not a YTD cumulative
}

function getUnitEntries(concept: XbrlConcept, preferredUnit: string): XbrlFactEntry[] {
  if (concept.units[preferredUnit]) return concept.units[preferredUnit];
  const firstKey = Object.keys(concept.units)[0];
  return firstKey ? concept.units[firstKey] : [];
}

function extractPeriodValues(
  usGaap: Record<string, XbrlConcept>,
  conceptNames: string[],
  preferredUnit: string,
): Map<string, number> {
  const byPeriod = new Map<string, number>();

  for (const conceptName of conceptNames) {
    const concept = usGaap[conceptName];
    if (!concept) continue;

    for (const entry of getUnitEntries(concept, preferredUnit)) {
      if (!isUsablePeriodEntry(entry)) continue;
      // Later entries overwrite earlier ones — SEC returns facts roughly
      // chronologically by filing date, so this prefers the most recently
      // filed (most likely restated/corrected) value for a given period.
      byPeriod.set(`${entry.fy}-${entry.fp}`, entry.val);
    }

    if (byPeriod.size > 0) break;
  }

  return byPeriod;
}

async function fetchCompanyFacts(cik: string): Promise<XbrlCompanyFacts> {
  const response = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { "User-Agent": SEC_USER_AGENT },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new AppError("UPSTREAM_UNAVAILABLE", "Could not reach SEC EDGAR to fetch financial statements.");
  }

  return response.json() as Promise<XbrlCompanyFacts>;
}

export const edgarXbrlMetricsProvider: MetricsProvider = {
  async getFinancialStatements(cik, opts) {
    const facts = await fetchCompanyFacts(cik);
    const usGaap = facts.facts?.["us-gaap"];
    if (!usGaap) return [];

    const revenue = extractPeriodValues(usGaap, CONCEPT_CANDIDATES.revenue, "USD");
    const netIncome = extractPeriodValues(usGaap, CONCEPT_CANDIDATES.netIncome, "USD");
    const grossProfit = extractPeriodValues(usGaap, CONCEPT_CANDIDATES.grossProfit, "USD");
    const eps = extractPeriodValues(usGaap, CONCEPT_CANDIDATES.eps, "USD/shares");
    const totalAssets = extractPeriodValues(usGaap, CONCEPT_CANDIDATES.totalAssets, "USD");
    const totalLiabilities = extractPeriodValues(usGaap, CONCEPT_CANDIDATES.totalLiabilities, "USD");

    const allKeys = new Set([
      ...revenue.keys(),
      ...netIncome.keys(),
      ...grossProfit.keys(),
      ...eps.keys(),
      ...totalAssets.keys(),
      ...totalLiabilities.keys(),
    ]);

    const sourceUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    const periodOrder = { FY: 4, Q4: 3, Q3: 2, Q2: 1, Q1: 0 } as const;

    const statements: FinancialStatementSummary[] = Array.from(allKeys).map((key) => {
      const [fyStr, fp] = key.split("-");
      return {
        fiscalYear: Number(fyStr),
        fiscalPeriod: fp as FinancialStatementSummary["fiscalPeriod"],
        revenue: revenue.has(key) ? String(revenue.get(key)) : null,
        netIncome: netIncome.has(key) ? String(netIncome.get(key)) : null,
        grossProfit: grossProfit.has(key) ? String(grossProfit.get(key)) : null,
        eps: eps.has(key) ? String(eps.get(key)) : null,
        totalAssets: totalAssets.has(key) ? String(totalAssets.get(key)) : null,
        totalLiabilities: totalLiabilities.has(key) ? String(totalLiabilities.get(key)) : null,
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
