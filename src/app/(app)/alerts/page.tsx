import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="User-defined alerts (price thresholds, new filings, upcoming earnings, thesis staleness)."
      />
      <EmptyState
        title="Not built yet"
        description="This is a real, tracked gap — not a placeholder pretending to be finished. See src/features/alerts/README.md for the planned design."
      />
    </div>
  );
}
