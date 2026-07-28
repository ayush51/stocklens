import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Modules under test construct a real Prisma client at import time
    // (src/lib/db/prisma-service.ts etc.), which needs env vars — Next.js
    // loads .env automatically, plain `vitest run` doesn't.
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
