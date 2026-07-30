import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getUpcomingEarningsForUser, getPastEarningsForUser } from "@/features/earnings/server/queries";
import { EarningsCalendarList } from "@/features/earnings/components/earnings-calendar-list";
import { PastEarningsList } from "@/features/earnings/components/past-earnings-list";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default async function EarningsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [rows, pastRows] = await Promise.all([
    getUpcomingEarningsForUser(user.id),
    getPastEarningsForUser(user.id),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <PageHeader
          title="Earnings calendar"
          description="Upcoming reports across your real holdings, next 120 days — consensus estimates only, no actuals until a company files."
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

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Past earnings</h2>
        {pastRows.length === 0 ? (
          <EmptyState
            title="No reviewable reports yet"
            description="This builds up as your holdings' upcoming reports pass their date — estimates are captured while a report is upcoming, since providers don't hand back historical ones."
          />
        ) : (
          <PastEarningsList rows={pastRows} />
        )}
      </div>
    </div>
  );
}
