/**
 * Filings data boundary — implemented by features/filings/providers/sec-edgar
 * (and any future secondary source) so feature code never talks to a vendor
 * SDK or raw fetch call directly. See docs/phase-0/02-architecture.md §3.
 */

export interface FilingSummary {
  externalId: string; // e.g. SEC accession number
  companyCik: string;
  formType: string; // "10-K", "10-Q", "8-K", …
  filedAt: string; // ISO 8601
  periodOfReport: string | null;
  documentUrl: string;
}

export interface FilingsProvider {
  listFilingsForCompany(
    cik: string,
    opts?: { formTypes?: string[]; limit?: number },
  ): Promise<FilingSummary[]>;
  getFilingDocumentText(documentUrl: string): Promise<string>;
}
