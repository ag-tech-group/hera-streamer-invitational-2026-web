/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_LOG_LEVEL?: string
  readonly VITE_TOURNAMENT_SLUG?: string
  /**
   * "true" serves the frozen tournament fully static from `public/data/` with
   * no live backend — see `src/lib/archive-mode.ts`. Unset/anything else =
   * normal live behavior.
   */
  readonly VITE_ARCHIVE_MODE?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string
  readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string
  readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
  /**
   * Override for the shared auth frontend URL (sign-in / profile).
   * Defaults to `https://auth.criticalbit.gg` — point at a local
   * `auth-web` instance during dev.
   */
  readonly VITE_AUTH_URL?: string
  /**
   * Override for the shared auth API URL (used for the cross-origin
   * logout POST). Defaults to `https://auth-api.criticalbit.gg` —
   * point at a local `auth-api` instance during dev.
   */
  readonly VITE_AUTH_API_URL?: string
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
