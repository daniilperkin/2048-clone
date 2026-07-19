import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "**/*.min.js"] },
  js.configs.recommended,
  prettier,
  {
    // Game files are loaded as plain <script> tags, so they share a
    // global scope across files (no ES modules). sourceType: "script"
    // matches how they are parsed in the browser.
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser },
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    // The flat config file itself uses ESM import/export and must be
    // parsed as a module. Listed AFTER the general block so it wins.
    files: ["eslint.config.js", "build-bundle.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
