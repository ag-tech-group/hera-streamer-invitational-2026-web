import path from "path"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * Release identifier baked into the bundle for Sentry's `release` field.
 * Netlify auto-sets `COMMIT_REF` for every build; locally we fall back to
 * "dev" so events are clearly distinguishable from production deploys.
 */
const releaseSha =
  process.env.COMMIT_REF || process.env.VITE_RELEASE_SHA || "dev"

/**
 * Sentry source-map upload — only runs when all three env vars are present
 * at build time. Lets the runtime integration land first (errors capture
 * with raw stacks) and switch on readable stack traces in production later
 * by setting these env vars, without any code change here.
 */
const sentryUpload =
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
    ? {
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      }
    : null

// Netlify-provided build context: "production" | "deploy-preview" |
// "branch-deploy". Falls back to "local" if a developer sets the SENTRY_*
// vars on their machine, so Sentry can still distinguish those builds.
const deployEnv = process.env.CONTEXT || "local"

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    ...(sentryUpload
      ? [
          sentryVitePlugin({
            ...sentryUpload,
            release: {
              name: releaseSha,
              // Marks each release as deployed to a specific environment so
              // Sentry's UI can show "this release went to production at T"
              // separately from preview/branch builds that share the SHA.
              deploy: { env: deployEnv },
              // Auto-associates commits between this release and the prior
              // one so Sentry can surface "suspect commits" for new errors.
              // ignoreMissing keeps builds green if the repo isn't yet linked
              // to Sentry via the GitHub integration.
              setCommits: { auto: true, ignoreMissing: true },
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Source maps land only when Sentry can upload them — "hidden" generates
    // the files (so the plugin can upload) but omits the //# sourceMappingURL
    // comment from the JS so they're not advertised to clients.
    sourcemap: sentryUpload ? "hidden" : false,
    // flag-icons references ~270 country SVGs via url(). At Vite's default
    // inline limit every small flag is base64-inlined into the CSS bundle
    // (~90 KB gzip of flags, nearly all unused). Keep them as separate files
    // so the browser fetches only the flags actually rendered on screen.
    assetsInlineLimit: (filePath: string) =>
      filePath.includes("flag-icons") ? false : undefined,
    rollupOptions: {
      output: {
        // Force the lazy-loaded posthog-js (and its internal modules) into
        // a stably-named chunk so scripts/size-check.mjs can budget it by
        // name. Without this, Rolldown emits a generic "module-XX.js" that
        // shifts as other dynamic chunks come and go.
        manualChunks(id: string) {
          if (id.includes("/posthog-js/")) return "posthog"
        },
      },
    },
  },
  define: {
    __APP_RELEASE__: JSON.stringify(releaseSha),
  },
})
