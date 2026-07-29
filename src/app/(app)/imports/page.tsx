import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import {
  getCsvImportHistoryForWorkspace,
  getPortfoliosForImportTarget,
} from "@/features/csv-import/server/queries";
import { PortfolioPickerWizard } from "@/features/csv-import/components/portfolio-picker-wizard";
import { ImportHistory } from "@/features/csv-import/components/import-history";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default async function ImportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { workspaceId } = await ensureWorkspaceForUser(user);

  const [portfolios, history] = await Promise.all([
    getPortfoliosForImportTarget(user.id, workspaceId),
    getCsvImportHistoryForWorkspace(user.id, workspaceId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Imports"
        description="Bring in transaction history from a brokerage CSV export. Every value is validated before anything is written, and every import can be rolled back."
      />

      {portfolios.length === 0 ? (
        <EmptyState
          title="No portfolio to import into yet"
          description="Sync your Robinhood portfolio or create a manual one first."
        />
      ) : (
        <PortfolioPickerWizard portfolios={portfolios} />
      )}

      {history.length > 0 ? <ImportHistory jobs={history} /> : null}
    </div>
  );
}
