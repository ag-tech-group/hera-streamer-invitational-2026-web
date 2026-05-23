/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_LOG_LEVEL?: string
  readonly VITE_TOURNAMENT_SLUG?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string
  readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string
  readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.css" {
  const content: string
  export default content
}

// Build-time release identifier (commit SHA on CI, "dev" locally) — injected
// by `define` in vite.config.ts. Sentry uses it as the release tag.
declare const __APP_RELEASE__: string
