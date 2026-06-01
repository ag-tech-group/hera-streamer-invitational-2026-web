import * as Sentry from "@sentry/react"

/**
 * Default sample rates (each overridable via `VITE_SENTRY_*_SAMPLE_RATE`),
 * tuned for a real-time tournament site whose failures are *correlated and
 * bursty* — one shared REST API + SSE stream, so when it breaks it tends to
 * break for every connected viewer at once.
 *
 *  - Traces: 5%. Web Vitals and product analytics already live in PostHog;
 *    the value Sentry adds is distributed tracing into the (already
 *    Sentry-traced) API. A low rate still links plenty of frontend→backend
 *    traces while keeping the highest-volume category cheap at peak traffic.
 *  - Replays on error: 10% — deliberately NOT 100%. A correlated outage would
 *    otherwise upload thousands of near-identical recordings in one burst;
 *    10% keeps a representative sample of any incident.
 *  - Replays per session: 0. No baseline session recording — replays only
 *    accompany errors.
 *
 * Sampling sets the average, not the worst case. Pair these with a per-category
 * spend cap in the Sentry dashboard (Settings → Subscription) so a traffic or
 * failure spike can never run away with quota.
 */
const DEFAULT_TRACES_SAMPLE_RATE = 0.05
const DEFAULT_REPLAYS_SESSION_SAMPLE_RATE = 0
const DEFAULT_REPLAYS_ON_ERROR_SAMPLE_RATE = 0.1

/**
 * Initializes Sentry when `VITE_SENTRY_DSN` is set; no-op otherwise (so local
 * dev without a DSN ships zero events).
 *
 * Capture posture: runtime errors at 100% (Sentry's default `sampleRate`,
 * deduped into issues); structured logs on (`enableLogs` — the app logger in
 * src/lib/logger.ts mirrors its warn/error output to Sentry's Logs product, so
 * non-throwing failures like the SSE stream reconnecting in a loop stay
 * visible); plus the low traces/replays sampling described above.
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
    // Activates Sentry's Logs product; the app logger forwards warn/error
    // records to `Sentry.logger.*` (see src/lib/logger.ts).
    enableLogs: true,
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      DEFAULT_TRACES_SAMPLE_RATE
    ),
    replaysSessionSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
      DEFAULT_REPLAYS_SESSION_SAMPLE_RATE
    ),
    replaysOnErrorSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
      DEFAULT_REPLAYS_ON_ERROR_SAMPLE_RATE
    ),
    // Drop errors thrown during a stale-chunk recovery reload. When a tab on a
    // previous build hits a rotated code-split chunk, chunk-reload.ts calls
    // `preventDefault()` on Vite's preloadError and reloads; under
    // preventDefault the failed import resolves `undefined`, so the router can
    // throw on it ("...reading 'component'") in the microtask before the reload
    // navigates away. We're leaving the page — that teardown error is moot, not
    // a bug worth an event. (flag set in src/lib/chunk-reload.ts)
    beforeSend(event) {
      if (window.__chunkReloadInFlight) return null
      return event
    },
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
