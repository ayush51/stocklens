/**
 * Verified against the real Supabase Postgres instance, same reasoning as
 * src/lib/db/rls.test.ts: RLS-scoped writes/reads can't be meaningfully
 * mocked. Reuses the same pre-existing throwaway test account, with fully
 * self-contained fixture data cleaned up afterward — never touches a real
 * user's workspace.
 *
 * Uses MSFT rather than AAPL deliberately: rls.test.ts uses the same
 * USER_A_ID and creates its own Thesis for AAPL under that shared
 * workspace. Vitest runs test files in parallel by default, and Thesis
 * has no unique constraint on (workspaceId, companyId) — a real, now-
 * documented gap, not something this test should silently work around by
 * picking a different company alone. Using a different company here just
 * removes the collision surface between these two specific files; it
 * doesn't fix the underlying missing constraint.
 *
 * Finnhub's free-tier calendar never returns past dates (see
 * EarningsCalendarEntry's doc comment), so the "upcoming -> becomes
 * reviewable once its date passes" persistence flow can't be exercised
 * end-to-end through the live provider in a test. Instead this creates the
 * EarningsEvent row directly (exactly what persistEarningsEvents would
 * have written had this quarter still been upcoming when it ran) against
 * a real, already-cached MSFT FinancialStatement row, so the
 * actual-vs-estimate join and beat/miss classification are verified
 * against real reported figures, not synthetic ones.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prismaService } from "@/lib/db/prisma-service";
import { forUser, executeAsUser } from "@/lib/db/rls";
import { Prisma } from "@/generated/prisma/client";
import { getPastEarningsForUser } from "@/features/earnings/server/queries";
import { saveEarningsReview } from "@/features/earnings/server/review";

const USER_A_ID = "2883be10-f0ee-4fb5-9e01-a02779935ed7";

async function ensureTestWorkspace(userId: string, email: string) {
  const prisma = forUser(userId);
  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, email } });

  const existing = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.workspace.id;

  const workspaceId = randomUUID();
  const memberId = randomUUID();
  await executeAsUser(
    userId,
    Prisma.sql`SELECT app_private.bootstrap_workspace(${workspaceId}::uuid, ${"Earnings review test workspace"}, ${memberId}::uuid, ${userId}::uuid)`,
  );
  return workspaceId;
}

describe("earnings review workflow (integration)", () => {
  let workspaceId: string;
  let companyId: string;
  let portfolioId: string;
  let holdingId: string;
  let thesisId: string;
  let earningsEventId: string;
  let statementFiscalYear: number;
  let statementFiscalPeriod: string;
  let statementEps: string;

  beforeAll(async () => {
    workspaceId = await ensureTestWorkspace(USER_A_ID, "earnings-review-test-a@example.com");

    const company = await prismaService.company.findFirst({ where: { ticker: "MSFT" } });
    if (!company) throw new Error("Fixture requires an MSFT Company row to exist");
    companyId = company.id;

    // A real, already-cached statement — verifies the join against actual
    // reported figures, not a fabricated stand-in.
    const statement = await prismaService.financialStatement.findFirst({
      where: { companyId, fiscalPeriod: { in: ["Q1", "Q2", "Q3", "Q4"] }, eps: { not: null } },
      orderBy: [{ fiscalYear: "desc" }, { fiscalPeriod: "desc" }],
    });
    if (!statement) throw new Error("Fixture requires a real cached MSFT FinancialStatement row to exist");
    statementFiscalYear = statement.fiscalYear;
    statementFiscalPeriod = statement.fiscalPeriod;
    statementEps = statement.eps!.toString();

    const portfolio = await prismaService.portfolio.create({
      data: { workspaceId, name: "Earnings review test portfolio", source: "MANUAL" },
    });
    portfolioId = portfolio.id;

    const holding = await prismaService.holding.create({
      data: { portfolioId, companyId, quantity: "10", averageCost: "100" },
    });
    holdingId = holding.id;

    const thesis = await prismaService.thesis.create({
      data: {
        workspaceId,
        companyId,
        holdingId,
        summary: "Earnings review test fixture thesis — not real investment content.",
      },
    });
    thesisId = thesis.id;

    // Set below the real actual EPS so the beat classification is real and
    // verifiable, not tautological (matching the real value exactly would
    // trivially classify as inline regardless of whether the math is right).
    const estimatedEps = (Number(statementEps) - 0.5).toFixed(2);
    const event = await prismaService.earningsEvent.create({
      data: {
        companyId,
        fiscalYear: statementFiscalYear,
        fiscalPeriod: statementFiscalPeriod as "Q1" | "Q2" | "Q3" | "Q4",
        reportDate: new Date("2020-01-01"), // arbitrary past date — real fixtures use real statement data, not this
        epsEstimate: estimatedEps,
        revenueEstimate: null,
      },
    });
    earningsEventId = event.id;
  });

  afterAll(async () => {
    await prismaService.earningsReview.deleteMany({ where: { earningsEventId } });
    await prismaService.thesisRevision.deleteMany({ where: { thesisId } });
    await prismaService.thesis.deleteMany({ where: { id: thesisId } });
    await prismaService.earningsEvent.deleteMany({ where: { id: earningsEventId } });
    await prismaService.holding.deleteMany({ where: { id: holdingId } });
    await prismaService.portfolio.deleteMany({ where: { id: portfolioId } });
  });

  it("joins the persisted estimate against the real FinancialStatement actual and classifies a real beat", async () => {
    const rows = await getPastEarningsForUser(USER_A_ID);
    const row = rows.find((r) => r.earningsEventId === earningsEventId);

    expect(row).toBeDefined();
    expect(row!.epsActual).toBe(statementEps);
    expect(row!.epsSurprise.classification).toBe("BEAT");
    expect(row!.epsSurprise.surprisePct).not.toBeNull();
    // Revenue actual should still resolve even though no revenue estimate was set on this fixture.
    expect(row!.revenueSurprise.classification).toBe("NO_ESTIMATE");
  });

  it("saves a review and spawns a ThesisRevision with trigger EARNINGS_REVIEW when affectsThesis is checked", async () => {
    const result = await saveEarningsReview(USER_A_ID, workspaceId, {
      earningsEventId,
      companyId,
      ticker: "MSFT",
      notes: "Beat on EPS — no change to the core thesis, but worth tracking margin trend.",
      affectsThesis: true,
    });

    expect(result.reviewId).toBeTruthy();

    const review = await prismaService.earningsReview.findUnique({ where: { id: result.reviewId } });
    expect(review?.workspaceId).toBe(workspaceId);
    expect(review?.affectsThesis).toBe(true);
    expect(review?.spawnedRevisionId).toBeTruthy();

    const revision = await prismaService.thesisRevision.findUnique({
      where: { id: review!.spawnedRevisionId! },
    });
    expect(revision?.thesisId).toBe(thesisId);
    expect(revision?.trigger).toBe("EARNINGS_REVIEW");
    expect(revision?.summary).toBe("Earnings review test fixture thesis — not real investment content.");

    const rows = await getPastEarningsForUser(USER_A_ID);
    const row = rows.find((r) => r.earningsEventId === earningsEventId);
    expect(row?.review?.affectsThesis).toBe(true);
    expect(row?.review?.notes).toContain("Beat on EPS");
  });

  it("saves a review without spawning a revision when affectsThesis is false", async () => {
    const result = await saveEarningsReview(USER_A_ID, workspaceId, {
      earningsEventId,
      companyId,
      ticker: "MSFT",
      notes: "No material change.",
      affectsThesis: false,
    });

    const review = await prismaService.earningsReview.findUnique({ where: { id: result.reviewId } });
    expect(review?.affectsThesis).toBe(false);
    expect(review?.spawnedRevisionId).toBeNull();
  });
});
