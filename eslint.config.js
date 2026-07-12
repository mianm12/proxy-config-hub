import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const typeScriptFiles = ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"];

export default defineConfig(
  {
    ignores: [".cache/**", "dist/**", "node_modules/**", "tests/expected/**"],
  },
  {
    files: typeScriptFiles,
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    files: ["eslint.config.js"],
    extends: [eslint.configs.recommended],
  },
);
