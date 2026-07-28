import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="A cross-portfolio summary lands here once portfolios exist (Phase 2)."
      />
      <EmptyState
        title="No portfolios yet"
        description="Portfolio creation, CSV import, and analytics ship in Phase 2 of the implementation plan."
      />
    </div>
  );
}
