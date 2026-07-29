import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { getThesisForCompany } from "@/features/thesis/server/queries";
import { ThesisForm } from "@/features/thesis/components/thesis-form";
import { PageHeader } from "@/shared/components/page-header";

export default async function EditThesisPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);
  if (!company) return null;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { workspaceId } = await ensureWorkspaceForUser(user);

  const thesis = await getThesisForCompany(user.id, workspaceId, company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={thesis ? "Edit thesis" : "Write a thesis"}
        description={`${company.name} (${ticker})`}
      />
      <ThesisForm
        companyId={company.id}
        cik={company.cik}
        companyName={company.name}
        ticker={ticker}
        existing={thesis}
      />
    </div>
  );
}
