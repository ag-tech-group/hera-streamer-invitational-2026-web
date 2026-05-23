import * as Sentry from "@sentry/react"

/**
 * Initializes Sentry error tracking when `VITE_SENTRY_DSN` is set; no-op
 * otherwise (so local dev without a DSN ships zero events).
 *
 * All three sample rates default to `0`, so by default the SDK captures
 * runtime errors only — no performance traces, no session replays. Each
 * can be raised independently via env (`VITE_SENTRY_*_SAMPLE_RATE`) for
 * tuning without a code change.
 *
 * Setting `VITE_SENTRY_DSN` locally is supported — Sentry will fire events
 * from your dev session, useful for verifying the integration end-to-end;
 * just be mindful of org quota if you leave it on for long.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    release: __APP_RELEASE__,
    environment: import.meta.env.MODE,
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
    ),
    replaysSessionSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE
    ),
    replaysOnErrorSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE
    ),
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  })
}

/**
 * Parses a sample-rate env var (a string like "0.1") to a number in `[0, 1]`,
 * falling back to `fallback` for unset, non-numeric, or out-of-range values.
 */
function parseSampleRate(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback
  const n = parseFloat(value)
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback
}
