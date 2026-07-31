import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
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

// Verified live (2026-07-30): a real ingestion run across ~30 companies'
// filing histories hit 429s almost immediately at 5-way concurrency,
// despite SEC's documented 10 req/sec fair-access limit — bounding
// concurrency alone wasn't conservative enough in practice. Same lesson
// already learned the hard way for Finnhub tonight (see that provider's
// own rate-limit comment): a serialized dispatch queue with a real
// minimum spacing between requests, shared across every call this
// provider makes (not per-company), plus retry-with-backoff on 429,
// rather than silently dropping a filing's data when SEC pushes back.
const MIN_REQUEST_SPACING_MS = 300;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
let dispatchQueue: Promise<void> = Promise.resolve();

function scheduleDispatch(): Promise<void> {
  const previous = dispatchQueue;
  let release!: () => void;
  dispatchQueue = new Promise((resolve) => {
    release = resolve;
  });
  return previous.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_SPACING_MS));
    release();
  });
}

async function pacedFetch(url: string, timeoutMs: number): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await scheduleDispatch();
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": SEC_USER_AGENT } }, timeoutMs);
    if (response.ok || response.status !== 429) return response;

    lastResponse = response;
    if (attempt < MAX_RETRIES) {
      const delayMs = BASE_DELAY_MS * 2 ** attempt;
      logger.warn("insider_rate_limited_retrying", { url, attempt: attempt + 1, delayMs });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return lastResponse!;
}

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

async function fetchSubmissions(
  cik: string,
): Promise<{ data: EdgarSubmissionsResponse | null; rateLimited: boolean }> {
  const startedAt = Date.now();
  const response = await pacedFetch(`https://data.sec.gov/submissions/CIK${cik}.json`, 15_000);

  if (!response.ok) {
    recordProviderCall({
      provider: "edgar-xbrl",
      operation: "insider_submissions",
      durationMs: Date.now() - startedAt,
      status: "ERROR",
      errorCategory: `http_${response.status}`,
      rateLimited: response.status === 429,
    });
    return { data: null, rateLimited: response.status === 429 };
  }

  recordProviderCall({
    provider: "edgar-xbrl",
    operation: "insider_submissions",
    durationMs: Date.now() - startedAt,
    status: "SUCCESS",
  });
  return { data: (await response.json()) as EdgarSubmissionsResponse, rateLimited: false };
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

async function fetchAndParseFiling(
  cik: string,
  filing: FilingRef,
): Promise<{ records: InsiderTransactionRecord[]; rateLimited: boolean }> {
  const cikNoLeadingZeros = String(Number(cik));
  const accessionNoDashes = filing.accessionNumber.replace(/-/g, "");
  const filingUrl = resolveRawXmlUrl(cikNoLeadingZeros, accessionNoDashes, filing.primaryDocument);

  const startedAt = Date.now();
  const response = await pacedFetch(filingUrl, 10_000);

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
    return { records: [], rateLimited: response.status === 429 };
  }

  const xml = await response.text();
  recordProviderCall({
    provider: "edgar-xbrl",
    operation: "insider_ownership_xml",
    durationMs: Date.now() - startedAt,
    status: "SUCCESS",
  });

  try {
    return {
      records: parseOwnershipXml(xml, {
        accessionNumber: filing.accessionNumber,
        filingDate: filing.filingDate,
        filingUrl,
      }),
      rateLimited: false,
    };
  } catch (error) {
    logger.warn("insider_filing_parse_failed", {
      cik,
      accessionNumber: filing.accessionNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return { records: [], rateLimited: false };
  }
}

export const secInsiderTransactionsProvider: InsiderTransactionsProvider = {
  async listTransactionsForIssuer(cik, opts) {
    const { data: submissions, rateLimited: submissionsRateLimited } = await fetchSubmissions(cik);
    if (!submissions) return { records: [], rateLimitFailures: submissionsRateLimited ? 1 : 0 };

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

    if (filings.length === 0) return { records: [], rateLimitFailures: 0 };

    // Sequential, not mapWithConcurrency: every request already goes
    // through the shared paced dispatch queue above, so parallelizing the
    // await calls here would only add complexity without changing the
    // real request rate.
    const records: InsiderTransactionRecord[] = [];
    let rateLimitFailures = 0;
    for (const filing of filings) {
      const result = await fetchAndParseFiling(cik, filing);
      records.push(...result.records);
      if (result.rateLimited) rateLimitFailures += 1;
    }
    return { records, rateLimitFailures };
  },
};
