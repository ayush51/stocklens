import { AppError } from "@/lib/errors";
import type { FilingsProvider, FilingSummary } from "@/shared/contracts/filings-provider";

const SEC_USER_AGENT = "StockLens research@stocklens.app";

interface EdgarSubmissionsResponse {
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

export const secEdgarFilingsProvider: FilingsProvider = {
  async listFilingsForCompany(cik, opts) {
    const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { "User-Agent": SEC_USER_AGENT },
      // Filings change more often than the ticker list, but still not
      // minute-to-minute — a few hours' cache is a reasonable trade-off
      // against hammering EDGAR on every page view.
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!response.ok) {
      throw new AppError("UPSTREAM_UNAVAILABLE", "Could not reach SEC EDGAR to list filings.");
    }

    const data = (await response.json()) as EdgarSubmissionsResponse;
    const recent = data.filings.recent;
    const cikNoLeadingZeros = String(Number(cik));

    const results: FilingSummary[] = [];
    for (let i = 0; i < recent.accessionNumber.length; i++) {
      const formType = recent.form[i];
      if (opts?.formTypes && !opts.formTypes.includes(formType)) continue;

      const accessionNoDashes = recent.accessionNumber[i].replace(/-/g, "");
      results.push({
        externalId: recent.accessionNumber[i],
        companyCik: cik,
        formType,
        filedAt: recent.filingDate[i],
        periodOfReport: recent.reportDate[i] || null,
        documentUrl: `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoDashes}/${recent.primaryDocument[i]}`,
      });

      if (opts?.limit && results.length >= opts.limit) break;
    }

    return results;
  },

  async getFilingDocumentText(documentUrl) {
    const response = await fetch(documentUrl, { headers: { "User-Agent": SEC_USER_AGENT } });
    if (!response.ok) {
      throw new AppError("UPSTREAM_UNAVAILABLE", "Could not fetch the filing document.");
    }
    return response.text();
  },
};
