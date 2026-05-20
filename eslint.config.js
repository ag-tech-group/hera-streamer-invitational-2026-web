import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

export default tseslint.config(
  // `dist` is the build output; `src/api/generated` is orval output (zod
  // schemas in particular have regex escapes that trip no-useless-escape
  // even though they're correct in the generated regexes).
  { ignores: ["dist", "src/api/generated/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: [
            "useTheme",
            "useAuth",
            "useAnalytics",
            "useFeatureFlag",
            "useInvalidateFeatureFlags",
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/test/**/*.{ts,tsx}",
      "src/components/ui/**/*.{ts,tsx}",
      "src/main.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  }
)
