/**
 * Verified against the real Supabase Postgres instance and real Company
 * rows already in the database (same reasoning as rls.test.ts) — name
 * resolution is exactly the kind of thing that shouldn't be exercised
 * against a mocked/synthetic company list, since real company names have
 * real quirks (punctuation, "Corp" vs "Corporation", etc).
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";

import { prismaService } from "@/lib/db/prisma-service";
import { resolveCompanyByCik, resolveCompanyByName, AUTO_ACCEPT_CONFIDENCE } from "./entity-resolution";

describe("entity resolution (integration)", () => {
  let testAliasId: string | null = null;

  afterAll(async () => {
    if (testAliasId) await prismaService.companyAlias.delete({ where: { id: testAliasId } });
  });

  it("resolves a real company by exact CIK with full confidence", async () => {
    const nvda = await prismaService.company.findFirst({ where: { ticker: "NVDA" } });
    if (!nvda?.cik) throw new Error("Fixture requires a real NVDA Company row with a CIK");

    const result = await resolveCompanyByCik(nvda.cik);
    expect(result).toEqual({ companyId: nvda.id, confidence: 1.0, method: "SEC_CIK_EXACT" });
  });

  it("returns null for an unknown CIK rather than guessing", async () => {
    const result = await resolveCompanyByCik("9999999999");
    expect(result).toBeNull();
  });

  it("resolves a real company by its exact stored name", async () => {
    const nvda = await prismaService.company.findFirst({ where: { ticker: "NVDA" } });
    if (!nvda) throw new Error("Fixture requires a real NVDA Company row");

    const result = await resolveCompanyByName(nvda.name);
    expect(result?.companyId).toBe(nvda.id);
    expect(result?.confidence).toBe(1.0);
    expect(result?.method).toBe("EXACT_NAME");
  });

  it("resolves a real company via normalized-name matching on a legal-suffix variant, at auto-accept confidence", async () => {
    const nvda = await prismaService.company.findFirst({ where: { ticker: "NVDA" } });
    if (!nvda) throw new Error("Fixture requires a real NVDA Company row");

    // The stored name is "NVIDIA CORP" — a realistic USAspending-style
    // variant ("NVIDIA CORPORATION") should still resolve confidently.
    const result = await resolveCompanyByName("NVIDIA CORPORATION");
    expect(result?.companyId).toBe(nvda.id);
    expect(result?.method).toBe("NORMALIZED_NAME");
    expect(result!.confidence).toBeGreaterThanOrEqual(AUTO_ACCEPT_CONFIDENCE);
  });

  it("resolves via a stored CompanyAlias", async () => {
    const nvda = await prismaService.company.findFirst({ where: { ticker: "NVDA" } });
    if (!nvda) throw new Error("Fixture requires a real NVDA Company row");

    const alias = await prismaService.companyAlias.create({
      data: {
        companyId: nvda.id,
        alias: "nvidia gpu division test alias",
        aliasType: "GOVERNMENT_CONTRACTOR_NAME",
        source: "test",
        verified: true,
      },
    });
    testAliasId = alias.id;

    const result = await resolveCompanyByName("nvidia gpu division test alias");
    expect(result?.companyId).toBe(nvda.id);
    expect(result?.method).toBe("VERIFIED_ALIAS");
    expect(result?.confidence).toBe(1.0);
  });

  it("returns null for a genuinely unrelated name rather than forcing a low-confidence match", async () => {
    const result = await resolveCompanyByName("Completely Unrelated Fictional Widget Manufacturing LLC");
    expect(result).toBeNull();
  });
});
