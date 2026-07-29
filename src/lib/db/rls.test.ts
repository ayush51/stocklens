/**
 * RLS cross-tenant isolation, verified against the real Supabase Postgres
 * instance — this cannot be meaningfully mocked, since the guarantee being
 * tested is enforced entirely by Postgres policies, not application code.
 * There's no separate test database (see docs/phase-0 notes on the
 * Supabase shadow-DB/`auth` schema incompatibility that already rules out
 * `prisma migrate diff` against a throwaway DB); this runs against the same
 * dev database every other live-verification script in this project uses,
 * with fully self-contained fixture data that's cleaned up afterward and
 * never touches a real user's workspace.
 *
 * `import "dotenv/config"` (not the `@/lib/env` mock used by other test
 * files) is deliberate: this test needs the real DATABASE_URL/
 * SERVICE_DATABASE_URL to actually exercise Postgres RLS.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prismaService } from "@/lib/db/prisma-service";
import { forUser, executeAsUser } from "@/lib/db/rls";
import { Prisma } from "@/generated/prisma/client";

// Pre-existing throwaway auth-backed test accounts already in the dev DB
// (no workspace of their own before this test) — reused rather than
// creating new auth.users rows, which is out of scope for a Prisma-level
// test and unnecessary here.
const USER_A_ID = "2883be10-f0ee-4fb5-9e01-a02779935ed7";
const USER_B_ID = "663b09ec-e5dc-4234-8d51-162e737857cb";

async function ensureTestWorkspace(userId: string, email: string) {
  const prisma = forUser(userId);
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email },
  });

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
    Prisma.sql`SELECT app_private.bootstrap_workspace(${workspaceId}::uuid, ${"RLS test workspace"}, ${memberId}::uuid, ${userId}::uuid)`,
  );
  return workspaceId;
}

describe("RLS cross-tenant isolation", () => {
  let workspaceAId: string;
  let workspaceBId: string;
  let portfolioAId: string;
  let holdingAId: string;
  let thesisAId: string;

  beforeAll(async () => {
    workspaceAId = await ensureTestWorkspace(USER_A_ID, "rls-test-a@example.com");
    workspaceBId = await ensureTestWorkspace(USER_B_ID, "rls-test-b@example.com");

    const company = await prismaService.company.findFirst({ where: { ticker: "AAPL" } });
    if (!company) throw new Error("Fixture requires an AAPL Company row to exist");

    // Service-role fixture setup, same reasoning as every other bootstrap
    // in this codebase: this is trusted test-setup code, not a real user
    // action, so it goes through prismaService rather than forUser().
    const portfolio = await prismaService.portfolio.create({
      data: { workspaceId: workspaceAId, name: "RLS test portfolio", source: "MANUAL" },
    });
    portfolioAId = portfolio.id;

    const holding = await prismaService.holding.create({
      data: { portfolioId: portfolioAId, companyId: company.id, quantity: "10", averageCost: "100" },
    });
    holdingAId = holding.id;

    const thesis = await prismaService.thesis.create({
      data: {
        workspaceId: workspaceAId,
        companyId: company.id,
        holdingId: holdingAId,
        summary: "RLS test fixture thesis — not real investment content.",
      },
    });
    thesisAId = thesis.id;
  });

  afterAll(async () => {
    // Explicit order rather than relying on cascade config, so cleanup is
    // correct regardless of each relation's onDelete behavior.
    await prismaService.thesis.deleteMany({ where: { id: thesisAId } });
    await prismaService.holding.deleteMany({ where: { id: holdingAId } });
    await prismaService.portfolio.deleteMany({ where: { id: portfolioAId } });
  });

  it("lets user A see their own portfolio, holding, and thesis (positive control)", async () => {
    const prisma = forUser(USER_A_ID);
    expect(await prisma.portfolio.findUnique({ where: { id: portfolioAId } })).not.toBeNull();
    expect(await prisma.holding.findUnique({ where: { id: holdingAId } })).not.toBeNull();
    expect(await prisma.thesis.findUnique({ where: { id: thesisAId } })).not.toBeNull();
  });

  it("denies user B any read of user A's portfolio", async () => {
    const prisma = forUser(USER_B_ID);
    expect(await prisma.portfolio.findUnique({ where: { id: portfolioAId } })).toBeNull();
    expect(await prisma.portfolio.findMany({ where: { workspaceId: workspaceAId } })).toEqual([]);
  });

  it("denies user B any read of user A's holding", async () => {
    const prisma = forUser(USER_B_ID);
    expect(await prisma.holding.findUnique({ where: { id: holdingAId } })).toBeNull();
  });

  it("denies user B any read of user A's thesis", async () => {
    const prisma = forUser(USER_B_ID);
    expect(await prisma.thesis.findUnique({ where: { id: thesisAId } })).toBeNull();
    expect(await prisma.thesis.findMany({ where: { workspaceId: workspaceAId } })).toEqual([]);
  });

  it("denies user B write access to user A's portfolio", async () => {
    const prisma = forUser(USER_B_ID);
    await expect(
      prisma.portfolio.update({ where: { id: portfolioAId }, data: { name: "hijacked" } }),
    ).rejects.toThrow();

    // Confirm the row is actually untouched, not just that Prisma threw for
    // an unrelated reason — the failed write must not have partially applied.
    const stillA = await prismaService.portfolio.findUnique({ where: { id: portfolioAId } });
    expect(stillA?.name).toBe("RLS test portfolio");
  });

  it("denies user B write access to user A's thesis", async () => {
    const prisma = forUser(USER_B_ID);
    await expect(
      prisma.thesis.update({ where: { id: thesisAId }, data: { summary: "hijacked" } }),
    ).rejects.toThrow();

    const stillA = await prismaService.thesis.findUnique({ where: { id: thesisAId } });
    expect(stillA?.summary).toBe("RLS test fixture thesis — not real investment content.");
  });

  it("keeps workspace B empty of workspace A's data even via a broad query", async () => {
    const prisma = forUser(USER_B_ID);
    const allVisiblePortfolios = await prisma.portfolio.findMany();
    expect(allVisiblePortfolios.every((p) => p.workspaceId === workspaceBId)).toBe(true);
  });
});
