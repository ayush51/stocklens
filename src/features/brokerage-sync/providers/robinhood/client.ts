/**
 * Authenticated read calls against Robinhood's unofficial API. Same caveat
 * as auth.ts: reverse-engineered surface, not a verified spec, not tested
 * against a live account from here.
 *
 * Every function here is a GET. There is no POST/PUT/PATCH/DELETE call to
 * any Robinhood endpoint anywhere in this module — that's not an oversight,
 * see shared/contracts/brokerage-sync-provider.ts and
 * docs/phase-0/09-security-model.md §3.1.
 */

const API_BASE = "https://api.robinhood.com";

async function authedGet<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Robinhood API request failed (${response.status}): ${url}`);
  }

  return response.json() as Promise<T>;
}

interface PaginatedResponse<T> {
  results: T[];
  next: string | null;
}

async function fetchAllPages<T>(initialUrl: string, accessToken: string): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = initialUrl;

  while (url) {
    const page: PaginatedResponse<T> = await authedGet<PaginatedResponse<T>>(url, accessToken);
    results.push(...page.results);
    url = page.next;
  }

  return results;
}

export interface RobinhoodAccount {
  account_number: string;
  url: string;
  type: string;
}

export async function getAccounts(accessToken: string): Promise<RobinhoodAccount[]> {
  return fetchAllPages<RobinhoodAccount>(`${API_BASE}/accounts/`, accessToken);
}

interface RobinhoodPositionRaw {
  account: string;
  instrument: string; // URL — resolved to a ticker via getInstrument
  quantity: string;
  average_buy_price: string;
}

export interface RobinhoodPosition {
  instrumentUrl: string;
  quantity: string;
  averageBuyPrice: string;
}

export async function getNonzeroPositions(accessToken: string): Promise<RobinhoodPosition[]> {
  const raw = await fetchAllPages<RobinhoodPositionRaw>(`${API_BASE}/positions/?nonzero=true`, accessToken);
  return raw.map((p) => ({
    instrumentUrl: p.instrument,
    quantity: p.quantity,
    averageBuyPrice: p.average_buy_price,
  }));
}

interface RobinhoodInstrument {
  symbol: string;
}

/**
 * Positions/orders reference an instrument by URL, not ticker — resolving
 * one is a second request. `cache` is caller-provided and shared across a
 * single sync run so the same instrument isn't resolved twice.
 */
export async function resolveInstrumentTicker(
  instrumentUrl: string,
  accessToken: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(instrumentUrl);
  if (cached) return cached;

  const instrument = await authedGet<RobinhoodInstrument>(instrumentUrl, accessToken);
  cache.set(instrumentUrl, instrument.symbol);
  return instrument.symbol;
}

interface RobinhoodOrderRaw {
  id: string;
  instrument: string;
  side: "buy" | "sell";
  state: string;
  average_price: string | null;
  cumulative_quantity: string;
  updated_at: string;
}

export interface RobinhoodFilledOrder {
  id: string;
  instrumentUrl: string;
  side: "buy" | "sell";
  price: string;
  quantity: string;
  occurredAt: string;
}

/** Only `state: "filled"` orders are real transactions — everything else (cancelled, rejected, queued) is excluded. */
export async function getFilledOrders(accessToken: string, since?: Date): Promise<RobinhoodFilledOrder[]> {
  const raw = await fetchAllPages<RobinhoodOrderRaw>(`${API_BASE}/orders/`, accessToken);

  return raw
    .filter((o) => o.state === "filled" && o.average_price !== null)
    .filter((o) => !since || new Date(o.updated_at) >= since)
    .map((o) => ({
      id: o.id,
      instrumentUrl: o.instrument,
      side: o.side,
      price: o.average_price as string,
      quantity: o.cumulative_quantity,
      occurredAt: o.updated_at,
    }));
}

interface RobinhoodDividendRaw {
  id: string;
  instrument: string;
  amount: string;
  paid_at: string | null;
}

export interface RobinhoodDividend {
  id: string;
  instrumentUrl: string;
  amount: string;
  paidAt: string;
}

export async function getDividends(accessToken: string, since?: Date): Promise<RobinhoodDividend[]> {
  const raw = await fetchAllPages<RobinhoodDividendRaw>(`${API_BASE}/dividends/`, accessToken);

  return raw
    .filter((d): d is RobinhoodDividendRaw & { paid_at: string } => d.paid_at !== null)
    .filter((d) => !since || new Date(d.paid_at) >= since)
    .map((d) => ({
      id: d.id,
      instrumentUrl: d.instrument,
      amount: d.amount,
      paidAt: d.paid_at,
    }));
}
