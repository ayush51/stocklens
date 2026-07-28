import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { getThesisForCompany } from "@/features/thesis/server/queries";
import { ThesisView } from "@/features/thesis/components/thesis-view";
import { getScorecardForThesis } from "@/features/thesis-scorecard/server/queries";
import { Scorecard } from "@/features/thesis-scorecard/components/scorecard";
import { EmptyState } from "@/shared/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function CompanyThesisPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);
  if (!company) return null; // layout already rendered the not-found state

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { workspaceId } = await ensureWorkspaceForUser(user);

  const thesis = await getThesisForCompany(user.id, workspaceId, company.id);

  if (!thesis) {
    return (
      <EmptyState
        title="No thesis yet"
        description="Write down why you own (or want to own) this company before the market moves — including what would prove you wrong."
        action={
          <Button size="sm" render={<Link href={`/companies/${ticker}/thesis/edit`} />}>
            Write a thesis
          </Button>
        }
      />
    );
  }

  const scorecard = await getScorecardForThesis(user.id, thesis.id);

  return (
    <div className="space-y-6">
      <ThesisView thesis={thesis} ticker={ticker} />
      <Scorecard thesisId={thesis.id} ticker={ticker} scorecard={scorecard} />
    </div>
  );
}
