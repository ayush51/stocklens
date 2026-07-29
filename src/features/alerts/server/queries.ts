import { forUser } from "@/lib/db/rls";

export interface AlertRuleSummary {
  id: string;
  type: string;
  config: Record<string, unknown>;
  active: boolean;
  companyId: string | null;
  ticker: string | null;
  companyName: string | null;
  thesisId: string | null;
  createdAt: Date;
}

/** Tenant data — workspace-scoped via forUser(). */
export async function getAlertRulesForWorkspace(
  userId: string,
  workspaceId: string,
): Promise<AlertRuleSummary[]> {
  const prisma = forUser(userId);
  const rules = await prisma.alertRule.findMany({
    where: { workspaceId },
    include: { workspace: false },
    orderBy: { createdAt: "desc" },
  });

  // Company is global reference data, not scoped by forUser's workspace
  // filter, so a second lightweight lookup — same reasoning as everywhere
  // else in this app that joins tenant rows to global reference data.
  const companyIds = [...new Set(rules.map((r) => r.companyId).filter((id): id is string => id !== null))];
  const companies =
    companyIds.length > 0 ? await prisma.company.findMany({ where: { id: { in: companyIds } } }) : [];
  const companyById = new Map(companies.map((c) => [c.id, c]));

  return rules.map((rule) => {
    const company = rule.companyId ? companyById.get(rule.companyId) : undefined;
    return {
      id: rule.id,
      type: rule.type,
      config: rule.config as Record<string, unknown>,
      active: rule.active,
      companyId: rule.companyId,
      ticker: company?.ticker ?? null,
      companyName: company?.name ?? null,
      thesisId: rule.thesisId,
      createdAt: rule.createdAt,
    };
  });
}

export interface AlertEventSummary {
  id: string;
  ruleType: string;
  ticker: string | null;
  message: string;
  firedAt: Date;
}

/** Tenant data — RLS composes through AlertRule's own tenant_isolation policy (see the AlertEvent policy's correlated EXISTS). */
export async function getAlertEventHistory(
  userId: string,
  workspaceId: string,
): Promise<AlertEventSummary[]> {
  const prisma = forUser(userId);
  const rules = await prisma.alertRule.findMany({
    where: { workspaceId },
    select: { id: true, type: true, companyId: true },
  });
  if (rules.length === 0) return [];

  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const companyIds = [...new Set(rules.map((r) => r.companyId).filter((id): id is string => id !== null))];
  const companies =
    companyIds.length > 0 ? await prisma.company.findMany({ where: { id: { in: companyIds } } }) : [];
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const events = await prisma.alertEvent.findMany({
    where: { alertRuleId: { in: rules.map((r) => r.id) } },
    orderBy: { firedAt: "desc" },
    take: 50,
  });

  return events.map((event) => {
    const rule = ruleById.get(event.alertRuleId);
    const company = rule?.companyId ? companyById.get(rule.companyId) : undefined;
    const payload = event.payload as { message?: string };
    return {
      id: event.id,
      ruleType: rule?.type ?? "UNKNOWN",
      ticker: company?.ticker ?? null,
      message: payload.message ?? "(no message)",
      firedAt: event.firedAt,
    };
  });
}
