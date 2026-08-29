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
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-debugger": "warn",
      "no-eval": "warn",
      "no-var": "warn",
      "eqeqeq": ["warn", "allow-null"],
      "no-case-declarations": "off",
      "no-empty": "off",
      "no-regex-spaces": "off",
      "no-useless-escape": "off",
      "no-prototype-builtins": "off",
      "no-control-regex": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "prefer-const": "off"
    }
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-case-declarations": "off"
    }
  }
);
