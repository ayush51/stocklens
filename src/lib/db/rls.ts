import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * Returns a Prisma client scoped to one user's session, for the duration of
 * each query. Every operation runs inside a transaction that first sets the
 * `request.jwt.claims` session variable Supabase's `auth.uid()` reads from —
 * without this, a direct Prisma connection has no way to tell RLS policies
 * who's asking, since auth.uid() is normally populated by Supabase's
 * PostgREST layer, which this app doesn't go through.
 *
 * This connects as `app_user` (see DATABASE_URL in src/lib/env.ts) — RLS-
 * constrained, so a bug here fails closed (empty results / permission
 * denied), not open. See docs/phase-0/09-security-model.md §2-3 and the
 * rls_and_roles migration.
 *
 * Usage: call once per request after resolving the user (e.g. right after
 * requireUser()), then use the returned client for every query in that
 * request — never fall back to the unscoped `prisma` import for tenant data.
 */
export function forUser(userId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const claims = JSON.stringify({ sub: userId, role: "authenticated" });
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof forUser>;

/**
 * Runs one raw statement (typically a call to a SECURITY DEFINER helper
 * function, e.g. app_private.bootstrap_workspace) under a user's claim
 * context.
 *
 * NOT covered by forUser(): Prisma Client Extensions' query-interception
 * hook (`$allModels.$allOperations`) only fires for model operations
 * (`.create()`, `.upsert()`, …) — `$executeRaw`/`$queryRaw` are client-level
 * methods that bypass it entirely. Calling one of those on a forUser()
 * client silently sets no claim, which is exactly the bug this exists to
 * prevent: use this instead of raw `$executeRaw` for anything that needs
 * auth.uid() to resolve.
 */
export async function executeAsUser(userId: string, sql: Prisma.Sql): Promise<void> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  await prisma.$transaction([
    prisma.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, TRUE)`,
    prisma.$executeRaw(sql),
  ]);
}
