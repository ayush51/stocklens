import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/db/prisma";

/**
 * Idempotent tenancy bootstrap: mirrors the Supabase Auth user into our
 * `User` table and ensures they own exactly one `Workspace` (V1 is
 * single-user-per-workspace — see docs/phase-0/04-database-design.md §2.1).
 *
 * Phase 0 called for a DB trigger/webhook on signup; that requires a live
 * Supabase project to configure, which doesn't exist yet during scaffolding.
 * This application-layer equivalent is safe to call on every authenticated
 * request (upsert + find-or-create, no duplicate workspaces) and can be
 * replaced by a DB trigger later without changing any caller.
 */
export async function ensureWorkspaceForUser(authUser: User) {
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: { email: authUser.email ?? undefined },
    create: {
      id: authUser.id,
      email: authUser.email ?? `${authUser.id}@unknown.local`,
    },
  });

  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (existingMembership) {
    return { workspaceId: existingMembership.workspace.id, workspaceName: existingMembership.workspace.name };
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: `${user.email.split("@")[0]}'s Workspace`,
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  return { workspaceId: workspace.id, workspaceName: workspace.name };
}
