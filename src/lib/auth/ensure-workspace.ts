import { randomUUID } from "node:crypto";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { forUser, executeAsUser } from "@/lib/db/rls";
import { Prisma } from "@/generated/prisma/client";

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
 *
 * Runs through the RLS-scoped client (not the raw `prisma` import) since
 * this is real tenant-data creation triggered by an authenticated user's own
 * request. The Workspace/WorkspaceMember pair is created via the
 * app_private.bootstrap_workspace() SECURITY DEFINER function rather than
 * Prisma's nested create: Postgres requires a newly-inserted row to satisfy
 * its own SELECT policy before RETURNING it (which Prisma's .create()
 * always requests), and a workspace has no member yet at the instant it's
 * created — a chicken-and-egg case that only a privileged, narrowly-scoped
 * function can resolve. See the bootstrap_workspace_function migration.
 */
export const ensureWorkspaceForUser = cache(async function ensureWorkspaceForUser(authUser: User) {
  const prisma = forUser(authUser.id);

  // Fast path for every request after the first: a returning user with a
  // workspace and an unchanged email needs one read, not an upsert (a write)
  // plus a second lookup — and the layout and the page both call this, so
  // cache() above also collapses the pair into one call per request.
  const known = await prisma.workspaceMember.findFirst({
    where: { userId: authUser.id },
    include: { workspace: true, user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (known && known.user.email === (authUser.email ?? `${authUser.id}@unknown.local`)) {
    return { workspaceId: known.workspace.id, workspaceName: known.workspace.name };
  }

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

  const workspaceId = randomUUID();
  const memberId = randomUUID();
  const workspaceName = `${user.email.split("@")[0]}'s Workspace`;

  await executeAsUser(
    authUser.id,
    Prisma.sql`SELECT app_private.bootstrap_workspace(${workspaceId}::uuid, ${workspaceName}, ${memberId}::uuid, ${user.id}::uuid)`,
  );

  return { workspaceId, workspaceName };
});
