import { forUser } from "@/lib/db/rls";

export interface WorkspaceSettings {
  id: string;
  name: string;
  createdAt: Date;
  members: { id: string; email: string; role: string; joinedAt: Date }[];
}

/** Tenant data — workspace-scoped via forUser(), RLS's workspace_select policy already restricts this to workspaces the user actually belongs to. */
export async function getWorkspaceSettings(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceSettings | null> {
  const prisma = forUser(userId);

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: { include: { user: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!workspace) return null;

  return {
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    members: workspace.members.map((m) => ({
      id: m.id,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
    })),
  };
}
