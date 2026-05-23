import posthog from "posthog-js"

import type { AnalyticsBackend } from "@/lib/analytics"
import { logger } from "@/lib/logger"

/**
 * PostHog product analytics integration.
 *
 * `initPostHog()` is a no-op when `VITE_POSTHOG_KEY` is unset, so local dev
 * without a key ships zero events. Autocapture is disabled (privacy-
 * conscious — we don't snapshot input values); explicit `track()` calls
 * via `useAnalytics()` drive the event set. Session recording is off by
 * default — quota-conscious, can be enabled later.
 *
 * The exported `posthogBackend` plugs straight into `AnalyticsProvider`'s
 * `backend` prop. When PostHog isn't initialised it falls back to logging
 * via the same logger the default backend uses, so dev observability is
 * preserved.
 *
 * **Future: feature flags + user identity.** When admin/owner controls
 * land, call `posthog.identify(userId, traits)` after login so PostHog's
 * per-user feature flags can evaluate. At that point `feature-flags.tsx`'s
 * `FeatureFlagProvider` can source flags from PostHog (via
 * `posthog.getAllFlags()` or the `onFeatureFlags` callback) in addition to
 * its current API/env fallback — the existing `useFeatureFlag()` hook
 * surface stays the same.
 */

const DEFAULT_HOST = "https://us.i.posthog.com"

let initialized = false

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || DEFAULT_HOST,
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: "localStorage",
  })
  initialized = true
}

export const posthogBackend: AnalyticsBackend = {
  track(event, properties) {
    if (initialized) {
      posthog.capture(event, properties)
    } else {
      logger.info("analytics.track", { event, ...properties })
    }
  },
  identify(userId, traits) {
    if (initialized) {
      posthog.identify(userId, traits)
    } else {
      logger.info("analytics.identify", { userId, ...traits })
    }
  },
  page(name, properties) {
    if (initialized) {
      posthog.capture("$pageview", { name, ...properties })
    } else {
      logger.info("analytics.page", { name, ...properties })
    }
  },
}
