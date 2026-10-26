import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { getDecisionEntriesForWorkspace } from "@/features/decision-journal/server/queries";
import { DecisionEntryForm } from "@/features/decision-journal/components/decision-entry-form";
import { DecisionEntryList } from "@/features/decision-journal/components/decision-entry-list";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export const metadata = { title: "Journal" };

export default async function JournalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { workspaceId } = await ensureWorkspaceForUser(user);

  const entries = await getDecisionEntriesForWorkspace(user.id, workspaceId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Decision journal"
        description="Record the reasoning behind every major portfolio decision before you act — not after, when hindsight makes everything look obvious."
      />

      <DecisionEntryForm />

      {entries.length === 0 ? (
        <EmptyState title="No decisions recorded yet" description="Your first entry will show up here." />
      ) : (
        <DecisionEntryList entries={entries} />
      )}
    </div>
  );
}
