import type { AnalyticsBackend } from "@/lib/analytics"
import { logger } from "@/lib/logger"
import { removeStored } from "@/lib/safe-storage"

/**
 * Minimal local interface for the subset of the PostHog SDK we call. Using
 * a local interface (rather than `import type` from `posthog-js` or
 * `typeof import("posthog-js")`) keeps any reference to the actual module
 * out of the static module graph, so Rolldown emits the SDK as a separate
 * async chunk via the `await import("posthog-js")` in `initPostHog()`.
 */
interface PostHogClient {
  capture: (event: string, properties?: Record<string, unknown>) => void
  identify: (distinctId: string, properties?: Record<string, unknown>) => void
}

/**
 * PostHog product analytics integration — lazy-loaded.
 *
 * `initPostHog()` is a no-op when `VITE_POSTHOG_KEY` is unset, so local dev
 * without a key ships zero events. Autocapture is disabled (privacy-
 * conscious — no input snapshots); explicit `track()` calls via
 * `useAnalytics()` drive the event set. Session recording is off by
 * default — quota-conscious, can be enabled later.
 *
 * **Lazy-loaded (#65)**: the SDK is fetched via dynamic `import()` so it
 * doesn't compete with first paint. Events captured before the SDK loads
 * are queued and flushed once `posthog.init()` completes. The init call
 * itself is fired from a `requestIdleCallback` in `main.tsx`, after the
 * page has painted. The `import type` above is purely a type import (no
 * runtime emission), so the SDK stays in its own async chunk.
 *
 * The exported `posthogBackend` plugs into `AnalyticsProvider`'s `backend`
 * prop. When PostHog is disabled (no key) it falls back to logging via the
 * same logger the default backend uses, so dev observability is preserved.
 *
 * **Future: feature flags + user identity.** When admin/owner controls
 * land, call the loaded client's `identify(userId, traits)` after login
 * so PostHog's per-user feature flags can evaluate. At that point
 * `feature-flags.tsx`'s `FeatureFlagProvider` can source flags from
 * `posthog.getAllFlags()` in addition to its current API/env fallback —
 * the existing `useFeatureFlag()` hook surface stays the same.
 *
 * **Toolbar: permanently disabled.** The PostHog toolbar (the in-page
 * heatmap/debug overlay launched from the PostHog app) must never render
 * on the public site — see `scrubToolbarLaunchState`.
 */

// Ingestion host. Production sets VITE_POSTHOG_HOST to the first-party reverse
// proxy (https://aoe2.criticalbit.gg/relay), proxied to PostHog by the
// criticalbit-router Cloudflare Worker, so privacy / ad blockers don't drop
// events by blocking *.i.posthog.com.
// Falls back to PostHog US cloud for local dev and direct ingestion.
const DEFAULT_HOST = "https://us.i.posthog.com"

const enabled = Boolean(import.meta.env.VITE_POSTHOG_KEY)

// posthog-js persists toolbar-launch params under this localStorage key after
// a `#__posthog=` visit and re-boots the toolbar from them on every later
// visit to the origin.
const TOOLBAR_PARAMS_KEY = "_postHogToolbarParams"

// The two hash keys posthog-js treats as a toolbar launch: `#__posthog={...}`
// ("Launch toolbar" in the PostHog app) and `#state=...` (its auth return
// trip). The `=` is required, so plain in-page anchors (`#civ-picks`) can
// never match.
const TOOLBAR_LAUNCH_HASH = /[#&?](?:__posthog|state)=/

/**
 * Keep the PostHog toolbar off this site — both of its boot triggers are
 * neutralised before the SDK can read them.
 *
 * The toolbar is PostHog's in-page heatmap/debug overlay, meant for project
 * members only, and posthog-js (checked at 1.376) has no config option to
 * turn it off. Worse, one `#__posthog=` launch persists its params to
 * localStorage, so the toolbar re-arms on every future visit in that
 * browser; once the launch's temporary auth token expires it renders as a
 * stuck, unstyled "Authenticating…" box floating over the page. So: drop
 * any persisted launch params, and strip a launch hash from the URL (with
 * the same `replaceState` the SDK itself uses, preserving router state).
 *
 * Must run before `import("posthog-js")` — the SDK samples `location.hash`
 * into a module-level constant at evaluation time, so scrubbing after the
 * import would be too late for the URL trigger.
 */
export function scrubToolbarLaunchState(): void {
  removeStored(TOOLBAR_PARAMS_KEY)
  if (TOOLBAR_LAUNCH_HASH.test(window.location.hash)) {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search
    )
  }
}

let client: PostHogClient | null = null
const pending: Array<(p: PostHogClient) => void> = []

export async function initPostHog(): Promise<void> {
  if (!enabled) return
  if (client) return // already initialised
  const key = import.meta.env.VITE_POSTHOG_KEY!
  scrubToolbarLaunchState()
  // Dynamic import keeps posthog-js out of the main bundle — it lands in
  // its own async chunk that loads after first paint (#65 perf audit). The
  // chunk's stable name ("posthog-XX.js") comes from `manualChunks` in
  // vite.config.ts, which scripts/size-check.mjs budgets by name.
  const { default: posthog } = await import("posthog-js")
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || DEFAULT_HOST,
    // When api_host is the first-party reverse proxy, ui_host points the SDK
    // at the real PostHog app so any generated UI links (e.g. the toolbar)
    // resolve to PostHog instead of the proxy path. No requests hit ui_host
    // during normal capture, so this is inert for end users. PostHog US.
    ui_host: "https://us.posthog.com",
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: "localStorage",
  })
  client = posthog
  // Flush events that fired before the SDK finished loading.
  for (const fn of pending) fn(posthog)
  pending.length = 0
}

/**
 * Either runs `fn` against the loaded PostHog client now, or queues it for
 * flush after `initPostHog()` resolves. Never queues when PostHog is
 * disabled (no key) so the queue can't grow without bound.
 */
function queueOrRun(fn: (p: PostHogClient) => void): void {
  if (!enabled) return
  if (client) {
    fn(client)
  } else {
    pending.push(fn)
  }
}

export const posthogBackend: AnalyticsBackend = {
  track(event, properties) {
    if (enabled) {
      queueOrRun((p) => p.capture(event, properties))
    } else {
      logger.info("analytics.track", { event, ...properties })
    }
  },
  identify(userId, traits) {
    if (enabled) {
      queueOrRun((p) => p.identify(userId, traits))
    } else {
      logger.info("analytics.identify", { userId, ...traits })
    }
  },
  page(name, properties) {
    if (enabled) {
      queueOrRun((p) => p.capture("$pageview", { name, ...properties }))
    } else {
      logger.info("analytics.page", { name, ...properties })
    }
  },
}
