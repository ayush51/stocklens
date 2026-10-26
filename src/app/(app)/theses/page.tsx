import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getThesisOverviewForUser } from "@/features/thesis/server/queries";
import { ThesisOverviewList } from "@/features/thesis/components/thesis-overview-list";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export const metadata = { title: "Theses" };

export default async function ThesesOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const rows = await getThesisOverviewForUser(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Theses"
        description="Every currently-held position, and whether you've written down why you own it."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No holdings yet"
          description="Sync a portfolio first — theses attach to positions you actually hold."
        />
      ) : (
        <ThesisOverviewList rows={rows} />
      )}
    </div>
  );
}
