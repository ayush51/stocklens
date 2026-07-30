import { AppError } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

// SEC requires every request to identify a contact — see
// https://www.sec.gov/os/webmaster-faq#developers. Configurable via
// SEC_EDGAR_USER_AGENT (see src/lib/env.ts) without a code change; read
// directly from process.env here rather than importing @/lib/env — see
// edgar-xbrl/index.ts's SEC_USER_AGENT comment for why.
const SEC_USER_AGENT = process.env.SEC_EDGAR_USER_AGENT || "StockLens research@stocklens.app";

interface EdgarTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

type EdgarTickerMap = Record<string, EdgarTickerEntry>;

export interface ResolvedTicker {
  ticker: string;
  /** Zero-padded 10-digit CIK, matching SEC's own formatting convention. */
  cik: string;
  name: string;
}

/**
 * SEC's full ticker -> CIK/name mapping (~10k entries, ~1MB). Cached via
 * Next's fetch cache rather than re-fetched per lookup — this list changes
 * rarely, so a day-long cache is generous, not stale in any way that
 * matters for ticker resolution.
 */
async function fetchEdgarTickerMap(): Promise<EdgarTickerMap> {
  const response = await fetchWithTimeout(
    "https://www.sec.gov/files/company_tickers.json",
    { headers: { "User-Agent": SEC_USER_AGENT }, next: { revalidate: 60 * 60 * 24 } },
    15_000, // ~1MB payload, allow a bit more than the default
  );

  if (!response.ok) {
    throw new AppError("UPSTREAM_UNAVAILABLE", "Could not reach SEC EDGAR to resolve the ticker.");
  }

  return response.json() as Promise<EdgarTickerMap>;
}

export async function resolveTickerViaEdgar(ticker: string): Promise<ResolvedTicker | null> {
  const normalized = ticker.trim().toUpperCase();
  const map = await fetchEdgarTickerMap();

  for (const entry of Object.values(map)) {
    if (entry.ticker.toUpperCase() === normalized) {
      return {
        ticker: entry.ticker.toUpperCase(),
        cik: String(entry.cik_str).padStart(10, "0"),
        name: entry.title,
      };
    }
  }

  return null;
}
