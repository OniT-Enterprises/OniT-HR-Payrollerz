import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";
import prettier from "eslint-config-prettier";

export default [
  // Global ignores
  {
    ignores: [
      "dist/",
      "node_modules/",
      "functions/",
      "firebaseemulator_payroll/",
      "scripts/",
      "netlify/",
      "server/",
      "mobile/",
      "*.config.js",
      "*.config.ts",
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript files
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "unused-imports": unusedImports,
    },
    rules: {
      // TypeScript recommended (manually applied for flat config)
      ...tsPlugin.configs["recommended"].rules,

      // Use unused-imports plugin for auto-fixable unused import removal
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",

      // Turn off base rules that TS handles
      "no-undef": "off",
      "no-redeclare": "off",

      // React hooks — the high-value rules
      ...reactHooks.configs.recommended.rules,
      // Disable React Compiler rules (we don't use React Compiler)
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",

      // React Refresh — Vite HMR compatibility
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // Prettier — disables formatting rules (must be last)
  prettier,
];
