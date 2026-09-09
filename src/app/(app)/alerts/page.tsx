import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { getThesisOverviewForUser } from "@/features/thesis/server/queries";
import { getAlertRulesForWorkspace, getAlertEventHistory } from "@/features/alerts/server/queries";
import { CreateRuleForm } from "@/features/alerts/components/create-rule-form";
import { RuleList } from "@/features/alerts/components/rule-list";
import { CheckNowButton } from "@/features/alerts/components/check-now-button";
import { EventHistory } from "@/features/alerts/components/event-history";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default async function AlertsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { workspaceId } = await ensureWorkspaceForUser(user);
  const [holdings, rules, events] = await Promise.all([
    getThesisOverviewForUser(user.id),
    getAlertRulesForWorkspace(user.id, workspaceId),
    getAlertEventHistory(user.id, workspaceId),
  ]);

  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Alerts"
          description="Price, earnings, and thesis-review alerts for your holdings."
        />
        <EmptyState title="No holdings yet" description="Alerts attach to positions you actually hold." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Price, earnings, and thesis-review alerts for your holdings — checked automatically once a day on weekday market close, and any time you click Check now below."
      />
      <CreateRuleForm
        companies={holdings.map((h) => ({
          companyId: h.companyId,
          ticker: h.ticker,
          name: h.name,
          thesisId: h.thesisId,
        }))}
      />
      <RuleList rules={rules} />
      <CheckNowButton />
      <EventHistory events={events} />
    </div>
  );
}
