import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { getWorkspaceSettings } from "@/features/workspace/server/queries";
import { WorkspaceSettingsForm } from "@/features/workspace/components/workspace-settings-form";
import { MemberList } from "@/features/workspace/components/member-list";
import { PageHeader } from "@/shared/components/page-header";

export default async function WorkspaceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { workspaceId } = await ensureWorkspaceForUser(user);
  const settings = await getWorkspaceSettings(user.id, workspaceId);
  if (!settings) return null;

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="Workspace settings" />
      <WorkspaceSettingsForm workspaceId={settings.id} initialName={settings.name} />
      <MemberList members={settings.members} />
      <Link href="/settings/observability" className="text-primary block text-sm font-medium hover:underline">
        View observability →
      </Link>
    </div>
  );
}
