import { createContext, useContext, useMemo } from "react"
import { logger } from "@/lib/logger"

/**
 * Analytics event reference (#215). Names follow `noun.verb[.verb]`. Fire
 * everything through `useAnalytics().track(event, props)` — never call the
 * PostHog SDK directly from a component. All props are public standings data
 * (no PII). Fire in the click/open handler, not a render effect, so each event
 * logs once per real user action.
 *
 * Automatic / cross-cutting:
 * - `page(path)`            route pageview — every resolved route change
 *                           (`root-component.tsx`); covers home / teams / stats.
 * - `view.changed`         `{ from, to }` — Players ⇄ Teams ⇄ Stats tabs.
 * - `theme.changed`        `{ from, to }`.
 * - `language.changed`     `{ from, to }`.
 * - `standings.retry`      `{ view }` — error-state retry button.
 *
 * Engagement (#215):
 * - `watch.click`          `{ profileId, alias, platform, streamLive, source: "standings" }`
 *                          — standings Watch-column stream link (the headline
 *                          "go watch" conversion).
 * - `host.link.click`      `{ kind, streamLive, source: "host_card" }`
 *                          — host promo-card link, by kind (twitch/youtube/
 *                          donate/patreon/social/other).
 * - `player.profile.click` `{ profileId, alias, source: "standings" }`
 *                          — player name → `presentation.profileUrl`.
 * - `player.bio.open`      `{ profileId, alias }` — bio hover/tap reveal.
 * - `prize.sponsor.click`  `{ sponsor }` — sponsor link on the prize-pool card.
 *
 * `profileId` is null for an unlinked entrant (announced but not yet joined).
 */
export interface AnalyticsBackend {
  track: (event: string, properties?: Record<string, unknown>) => void
  identify: (userId: string, traits?: Record<string, unknown>) => void
  page: (name?: string, properties?: Record<string, unknown>) => void
}

const defaultBackend: AnalyticsBackend = {
  track(event, properties) {
    logger.info("analytics.track", { event, ...properties })
  },
  identify(userId, traits) {
    logger.info("analytics.identify", { userId, ...traits })
  },
  page(name, properties) {
    logger.info("analytics.page", { name, ...properties })
  },
}

const AnalyticsContext = createContext<AnalyticsBackend>(defaultBackend)

interface AnalyticsProviderProps {
  children: React.ReactNode
  backend?: AnalyticsBackend
}

export function AnalyticsProvider({
  children,
  backend,
}: AnalyticsProviderProps) {
  const value = useMemo(() => backend ?? defaultBackend, [backend])
  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  return useContext(AnalyticsContext)
}
