import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { forUser } from "@/lib/db/rls";
import { getRobinhoodConnection } from "@/features/brokerage-sync/server/queries";
import { RobinhoodConnectForm } from "@/features/brokerage-sync/components/robinhood-connect-form";
import { DisconnectButton } from "@/features/brokerage-sync/components/disconnect-button";
import { SyncNowButton } from "@/features/brokerage-sync/components/sync-now-button";
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function RobinhoodIntegrationPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  const { workspaceId } = await ensureWorkspaceForUser(user);
  const prisma = forUser(user.id);

  const existing = await getRobinhoodConnection(prisma, workspaceId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Robinhood"
        description="Read-only. StockLens can never place trades, transfer funds, cancel orders, exercise options, or change any account setting — there is no code path that does any of that, not just a setting that's turned off."
      />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          {!existing ? <CardDescription>Not connected.</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {existing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={existing.connection.status === "CONNECTED" ? "default" : "outline"}>
                  {existing.connection.status}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {existing.connection.lastSyncedAt
                    ? `Last synced ${dateTimeFormatter.format(existing.connection.lastSyncedAt)}`
                    : "Never synced yet"}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                Scopes: {existing.connection.scopes.join(", ")}
              </p>
              {existing.connection.status !== "DISCONNECTED" ? (
                <div className="flex items-center gap-3">
                  <SyncNowButton portfolioId={existing.portfolio.id} />
                  <DisconnectButton portfolioId={existing.portfolio.id} />
                </div>
              ) : (
                <RobinhoodConnectForm />
              )}
            </div>
          ) : (
            <RobinhoodConnectForm />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
