import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import eslintConfigPrettier from "eslint-config-prettier";

// This installed eslint-config-next version ships only the legacy eslintrc
// format (no flat-config export), so it's bridged via FlatCompat rather than
// spread directly — see the flat-config migration note this produced during
// scaffolding.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Must stay last: turns off ESLint stylistic rules that would otherwise
  // fight Prettier's formatting.
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"]),
]);

export default eslintConfig;
