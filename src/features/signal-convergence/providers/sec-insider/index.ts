import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { mapWithConcurrency } from "@/lib/concurrency";
import { logger } from "@/lib/logger";
import { recordProviderCall } from "@/lib/provider-log";
import { parseOwnershipXml } from "./parse-ownership-xml";
import type {
  InsiderTransactionRecord,
  InsiderTransactionsProvider,
} from "@/shared/contracts/insider-transactions-provider";

// Required by SEC's fair-access rules (https://www.sec.gov/os/webmaster-faq#developers)
// — every request must identify a real contact, configurable via
// SEC_EDGAR_USER_AGENT (see src/lib/env.ts) without a code change. Read
// directly from process.env rather than importing @/lib/env — see
// edgar-xbrl/index.ts's SEC_USER_AGENT comment for why.
const SEC_USER_AGENT = process.env.SEC_EDGAR_USER_AGENT || "StockLens research@stocklens.app";
const INSIDER_FORM_TYPES = new Set(["3", "4", "4/A", "5", "5/A"]);
// SEC's documented fair-access limit is 10 req/sec; bounding concurrency
// (rather than a fixed inter-request delay) keeps this well under that
// while still fetching a company's recent filings in parallel.
const MAX_CONCURRENT_FILING_FETCHES = 5;

interface EdgarSubmissionsResponse {
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

interface FilingRef {
  accessionNumber: string;
  filingDate: string;
  primaryDocument: string;
}

async function fetchSubmissions(cik: string): Promise<EdgarSubmissionsResponse | null> {
  const startedAt = Date.now();
  const response = await fetchWithTimeout(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
    { headers: { "User-Agent": SEC_USER_AGENT }, next: { revalidate: 60 * 60 } },
    15_000,
  );

  if (!response.ok) {
    recordProviderCall({
      provider: "edgar-xbrl",
      operation: "insider_submissions",
      durationMs: Date.now() - startedAt,
      status: "ERROR",
      errorCategory: `http_${response.status}`,
      rateLimited: response.status === 429,
    });
    return null;
  }

  recordProviderCall({
    provider: "edgar-xbrl",
    operation: "insider_submissions",
    durationMs: Date.now() - startedAt,
    status: "SUCCESS",
  });
  return response.json() as Promise<EdgarSubmissionsResponse>;
}

/**
 * The submissions API's primaryDocument for a Form 3/4/5 points at the
 * XSLT-transformed HTML rendering (e.g. "xslF345X06/wk-form4_123.xml") —
 * verified live (2026-07-30) that fetching that exact path returns
 * rendered HTML, not parseable XML, despite the ".xml" extension. The
 * real raw ownership XML lives at the same filename one directory up
 * (confirmed against the filing's own index page).
 */
function resolveRawXmlUrl(
  cikNoLeadingZeros: string,
  accessionNoDashes: string,
  primaryDocument: string,
): string {
  const filename = primaryDocument.split("/").pop() ?? primaryDocument;
  return `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoDashes}/${filename}`;
}

async function fetchAndParseFiling(cik: string, filing: FilingRef): Promise<InsiderTransactionRecord[]> {
  const cikNoLeadingZeros = String(Number(cik));
  const accessionNoDashes = filing.accessionNumber.replace(/-/g, "");
  const filingUrl = resolveRawXmlUrl(cikNoLeadingZeros, accessionNoDashes, filing.primaryDocument);

  const startedAt = Date.now();
  const response = await fetchWithTimeout(
    filingUrl,
    { headers: { "User-Agent": SEC_USER_AGENT }, next: { revalidate: 60 * 60 * 24 } },
    10_000,
  );

  if (!response.ok) {
    recordProviderCall({
      provider: "edgar-xbrl",
      operation: "insider_ownership_xml",
      durationMs: Date.now() - startedAt,
      status: "ERROR",
      errorCategory: `http_${response.status}`,
      rateLimited: response.status === 429,
    });
    logger.warn("insider_filing_fetch_failed", {
      cik,
      accessionNumber: filing.accessionNumber,
      status: response.status,
    });
    return [];
  }

  const xml = await response.text();
  recordProviderCall({
    provider: "edgar-xbrl",
    operation: "insider_ownership_xml",
    durationMs: Date.now() - startedAt,
    status: "SUCCESS",
  });

  try {
    return parseOwnershipXml(xml, {
      accessionNumber: filing.accessionNumber,
      filingDate: filing.filingDate,
      filingUrl,
    });
  } catch (error) {
    logger.warn("insider_filing_parse_failed", {
      cik,
      accessionNumber: filing.accessionNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export const secInsiderTransactionsProvider: InsiderTransactionsProvider = {
  async listTransactionsForIssuer(cik, opts) {
    const submissions = await fetchSubmissions(cik);
    if (!submissions) return [];

    const { recent } = submissions.filings;
    const filings: FilingRef[] = [];
    for (let i = 0; i < recent.form.length; i++) {
      if (!INSIDER_FORM_TYPES.has(recent.form[i])) continue;
      if (opts?.since && recent.filingDate[i] < opts.since.toISOString().slice(0, 10)) continue;
      filings.push({
        accessionNumber: recent.accessionNumber[i],
        filingDate: recent.filingDate[i],
        primaryDocument: recent.primaryDocument[i],
      });
      if (opts?.limit && filings.length >= opts.limit) break;
    }

    if (filings.length === 0) return [];

    const results = await mapWithConcurrency(filings, MAX_CONCURRENT_FILING_FETCHES, (filing) =>
      fetchAndParseFiling(cik, filing),
    );

    return results.flat();
  },
};
