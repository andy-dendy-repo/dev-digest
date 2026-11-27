// ESLint 9 flat config for the DevDigest web client.
// Enforces the import/export rules of the frontend-ui-architecture skill
// (.claude/skills/frontend-ui-architecture/SKILL.md §2, §7) plus React hooks rules.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    // Vendored copies (vendor/shared must stay identical to the server copy) and build output.
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "src/vendor/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  nextPlugin.flatConfig.coreWebVitals,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    rules: {
      // The typescript-eslint variant: same options as the core rule, plus `allowTypeImports`.
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(\\.\\./)+(.*/)?(lib|components|i18n|test|vendor)(/|$)",
              message: "Import lib/, components/, i18n/, test/ and vendor/ through the @/ alias, not a relative path.",
            },
            {
              group: ["@devdigest/ui/*"],
              message: "Import the design system from its barrel: '@devdigest/ui'.",
            },
          ],
          paths: [
            {
              name: "@devdigest/shared",
              allowTypeImports: true,
              message:
                "Only `import type` from @devdigest/shared: its barrel uses `.js` specifiers that Next's webpack cannot resolve (Vitest can, so tests pass and the page breaks).",
            },
            {
              name: "@/lib/hooks",
              message: "Import the domain file directly, e.g. '@/lib/hooks/reviews' (there is no hooks barrel).",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message: "No `export *` barrels outside @devdigest/ui: re-export by name.",
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Node-side config files.
    files: ["*.mjs"],
    languageOptions: { globals: { process: "readonly" } },
  },
);
