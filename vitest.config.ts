import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  // Mirror vite.config.ts's `define` so the build-time release global resolves
  // under test instead of throwing ReferenceError when a module reads it at
  // import time (e.g. version-check.ts). A fixed value is fine — tests inject
  // their own version where it matters.
  define: {
    __APP_RELEASE__: JSON.stringify("test"),
  },
  test: {
    globals: true,
    environment: "jsdom",
    env: {
      VITE_LOG_LEVEL: "warn",
      // Pin app config so tests stay hermetic — independent of local
      // .env files (gitignored, so absent in CI). The API base must be
      // origin-only: the generated MSW mocks match `*/v1/...`, which the
      // production `/api` fallback (a path prefix) would not.
      VITE_API_URL: "http://localhost:3000",
      VITE_TOURNAMENT_SLUG: "hera-streamer-invitational-2026",
    },
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.d.ts",
        "src/routeTree.gen.ts",
        "src/main.tsx",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
