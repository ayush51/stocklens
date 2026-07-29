import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getUpcomingEarningsForUser } from "@/features/earnings/server/queries";
import { EarningsCalendarList } from "@/features/earnings/components/earnings-calendar-list";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default async function EarningsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const rows = await getUpcomingEarningsForUser(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings calendar"
        description="Upcoming reports across your real holdings, next 120 days — consensus estimates only, no actuals until a company files (see its Financials tab once reported)."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description="Either no holdings have an earnings report in the next 120 days, or no market-data provider is configured."
        />
      ) : (
        <EarningsCalendarList rows={rows} />
      )}
    </div>
  );
}
