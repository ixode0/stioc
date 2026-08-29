import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["compiled/**", "dist/**", "node_modules/**", "typings/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: false
      }
    },
    rules: {
      // migrated from tslint.json: keep minimal parity
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-debugger": "error",
      "no-eval": "error",
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "allow-null"]
    }
  }
);
