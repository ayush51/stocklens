import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { recordProviderCall } from "@/lib/provider-log";
import { logger } from "@/lib/logger";
import { classifyContractAction } from "@/features/signal-convergence/lib/contract-classification";
import type {
  GovernmentContractEventRecord,
  GovernmentContractsProvider,
} from "@/shared/contracts/government-contracts-provider";

const BASE_URL = "https://api.usaspending.gov/api/v2";
// Contract award type codes ("A" definitive contract, "B" purchase order,
// "C" delivery order, "D" BPA call) — deliberately excludes grants/loans,
// which this feature doesn't cover.
const CONTRACT_AWARD_TYPE_CODES = ["A", "B", "C", "D"];
const MAX_AWARDS_PER_RECIPIENT = 15;
const MAX_TRANSACTIONS_PER_AWARD = 20;

interface SpendingByAwardResult {
  "Award ID": string;
  "Recipient Name": string;
  "Recipient UEI": string | null;
  "Awarding Agency": string;
  "Award Amount": number | null;
  Description: string | null;
  "Start Date": string | null;
  "End Date": string | null;
  "Base Obligation Date": string | null;
  generated_internal_id: string;
}

interface SpendingByAwardResponse {
  results: SpendingByAwardResult[];
}

interface TransactionResult {
  action_date: string;
  action_type: string | null;
  action_type_description: string | null;
  modification_number: string | null;
  description: string | null;
  federal_action_obligation: number | null;
}

interface TransactionsResponse {
  results: TransactionResult[];
}

// A full ingestion run makes many sequential calls here (up to 15 award
// searches x 20 transaction fetches, per company, across every tracked
// company) — a light minimum spacing plus retry-on-429 is cheap
// insurance against the same rate-limit surprise already hit for real
// with SEC EDGAR (see the sec-insider provider's own comment), even
// though a single-recipient test against this API didn't surface one.
const MIN_REQUEST_SPACING_MS = 150;
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1500;
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

async function postWithRetry(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  let response: Response;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await scheduleDispatch();
    response = await fetchWithTimeout(
      `${BASE_URL}${path}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      timeoutMs,
    );
    if (response.ok || response.status !== 429 || attempt === MAX_RETRIES) return response;
    await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
  }
  throw new Error("unreachable"); // MAX_RETRIES >= 0 guarantees the loop above always returns
}

async function postJson<T>(path: string, body: unknown, timeoutMs = 15_000): Promise<T | null> {
  const startedAt = Date.now();
  const response = await postWithRetry(path, body, timeoutMs);

  if (!response.ok) {
    recordProviderCall({
      provider: "usaspending",
      operation: path,
      durationMs: Date.now() - startedAt,
      status: "ERROR",
      errorCategory: `http_${response.status}`,
      rateLimited: response.status === 429,
    });
    return null;
  }

  recordProviderCall({
    provider: "usaspending",
    operation: path,
    durationMs: Date.now() - startedAt,
    status: "SUCCESS",
  });
  return response.json() as Promise<T>;
}

async function searchAwardsForRecipient(recipientName: string): Promise<SpendingByAwardResult[]> {
  const data = await postJson<SpendingByAwardResponse>("/search/spending_by_award/", {
    filters: {
      recipient_search_text: [recipientName],
      award_type_codes: CONTRACT_AWARD_TYPE_CODES,
      // USAspending caps historical search at 2007-10-01; a wide-but-bounded
      // window keeps this call fast rather than scanning the entire archive
      // — recency filtering on individual actions happens below via `since`.
      time_period: [{ start_date: "2015-01-01", end_date: new Date().toISOString().slice(0, 10) }],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Recipient UEI",
      "Awarding Agency",
      "Award Amount",
      "Description",
      "Start Date",
      "End Date",
      "Base Obligation Date",
      "generated_internal_id",
    ],
    page: 1,
    limit: MAX_AWARDS_PER_RECIPIENT,
    sort: "Award Amount",
    order: "desc",
  });

  return data?.results ?? [];
}

async function fetchTransactionsForAward(awardId: string): Promise<TransactionResult[]> {
  const data = await postJson<TransactionsResponse>("/transactions/", {
    award_id: awardId,
    limit: MAX_TRANSACTIONS_PER_AWARD,
    page: 1,
  });
  return data?.results ?? [];
}

export const usaSpendingContractsProvider: GovernmentContractsProvider = {
  async listRecentContractActionsForRecipient(recipientName, opts) {
    const awards = await searchAwardsForRecipient(recipientName);
    if (awards.length === 0) return [];

    const sinceDateStr = opts?.since?.toISOString().slice(0, 10) ?? null;
    const events: GovernmentContractEventRecord[] = [];

    for (const award of awards) {
      let transactions: TransactionResult[];
      try {
        transactions = await fetchTransactionsForAward(award.generated_internal_id);
      } catch (error) {
        logger.warn("usaspending_transactions_fetch_failed", {
          awardId: award.generated_internal_id,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      for (const tx of transactions) {
        if (sinceDateStr && tx.action_date < sinceDateStr) continue;

        const federalActionObligation = tx.federal_action_obligation ?? 0;
        events.push({
          externalId: award.generated_internal_id,
          modificationNumber: tx.modification_number,
          recipientLegalName: award["Recipient Name"],
          // USAspending's search response doesn't reliably surface a
          // resolvable parent-company name field for contract recipients —
          // left null rather than guessed; entity resolution handles
          // subsidiary -> public-parent mapping separately, on the
          // recipient name itself, not on a fabricated parent field here.
          parentRecipientName: null,
          awardingAgency: award["Awarding Agency"],
          description: tx.description || award.Description,
          awardType: tx.action_type_description ?? "Unknown",
          recordType: classifyContractAction({
            modificationNumber: tx.modification_number,
            actionDate: tx.action_date,
            baseObligationDate: award["Base Obligation Date"],
            federalActionObligation,
          }),
          actionDate: tx.action_date,
          startDate: award["Start Date"],
          endDate: award["End Date"],
          currentAwardAmount: award["Award Amount"] !== null ? String(award["Award Amount"]) : null,
          newlyObligatedAmount: String(federalActionObligation),
          potentialAwardAmount: award["Award Amount"] !== null ? String(award["Award Amount"]) : null,
          sourceUrl: `https://www.usaspending.gov/award/${award.generated_internal_id}`,
        });

        if (opts?.limit && events.length >= opts.limit) return events;
      }
    }

    return events;
  },
};
