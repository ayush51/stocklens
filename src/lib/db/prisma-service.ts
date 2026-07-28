import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/lib/env";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaService: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: env.SERVICE_DATABASE_URL });

/**
 * Connects as `service_role_app` (BYPASSRLS) — for trusted system code only:
 * background jobs, seed scripts, global reference-data ingestion. Never
 * import this to serve a specific user's request; use
 * src/lib/db/rls.ts#forUser for that. See docs/phase-0/09-security-model.md §2-3.
 */
export const prismaService = globalForPrisma.prismaService ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prismaService = prismaService;
}
