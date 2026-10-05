import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.browser },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }]
    }
  }
];
