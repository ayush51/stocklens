import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // No @vitejs/plugin-react — its Babel toolchain conflicts with shadcn's
  // own Babel peer deps. Vite's default oxc transform handles .tsx JSX, but
  // only once told the runtime explicitly — otherwise it inherits
  // tsconfig's `jsx: "preserve"` (set for Next's own SWC pipeline) and
  // leaves raw JSX syntax untransformed.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
