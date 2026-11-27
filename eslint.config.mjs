import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // Local git worktrees hold other branches and their build output.
    ".worktrees/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      // New in eslint-plugin-react-hooks 7.1. It flags the common "load data on mount"
      // effect (the loader sets loading state), which is how ~40 admin/workspace/portal
      // screens fetch today. Moving them to a data layer is a separate refactor, so the
      // rule is off rather than failing lint or hiding behind per-line disables.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
