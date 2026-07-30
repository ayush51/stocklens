import type { CongressionalTransactionRecord } from "@/shared/contracts/congressional-transactions-provider";
import { createManualCongressProvider } from "./index";

/**
 * Clearly-fake development/demo data — NOT real disclosures. Every field
 * is fabricated on purpose to make that obvious (unrealistic round dollar
 * amounts, placeholder names). Never wired into anything that writes to
 * the real database in a production ingestion run; sourceName/
 * isLiveOfficialSource on the returned provider both flag this
 * unambiguously, and the UI must surface that flag wherever this
 * provider's data is shown — see this feature's data-health view.
 */
export const SAMPLE_CONGRESS_RECORDS: CongressionalTransactionRecord[] = [
  {
    politicianName: "Sample Representative A",
    chamber: "HOUSE",
    state: "CA",
    party: "Independent",
    owner: "SELF",
    assetNameDisclosed: "NVIDIA Corp",
    transactionType: "PURCHASE",
    transactionDate: "2026-06-01",
    filingDate: "2026-06-25",
    reportedRangeMin: "15001",
    reportedRangeMax: "50000",
    filingUrl: null,
    externalId: "sample-house-1",
  },
  {
    politicianName: "Sample Senator B",
    chamber: "SENATE",
    state: "TX",
    party: "Independent",
    owner: "SPOUSE",
    assetNameDisclosed: "Apple Inc",
    transactionType: "SALE",
    transactionDate: "2026-05-10",
    filingDate: "2026-06-02",
    reportedRangeMin: "1001",
    reportedRangeMax: "15000",
    filingUrl: null,
    externalId: "sample-senate-1",
  },
];

export const sampleCongressProvider = createManualCongressProvider(SAMPLE_CONGRESS_RECORDS, "sample_fixture");
