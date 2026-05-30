import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { useAnalytics } from "@/lib/analytics"
import { cn } from "@/lib/utils"

/** Which standings table the home page is showing. */
export type StandingsView = "players" | "teams"

/** The two views and the path-based routes that back them (#163). */
const TABS: { view: StandingsView; to: "/" | "/teams" }[] = [
  { view: "players", to: "/" },
  { view: "teams", to: "/teams" },
]

/**
 * Underline-indicator tab strip switching between the players and team
 * standings. Each tab is a router `<Link>` to its own path-based route
 * (`/` and `/teams`, #163), so the active view is URL-driven — deep-linkable,
 * and browser back/forward toggles between them. The active tab (matched
 * against the route-derived `value`) carries a brand-blue 2px bottom border
 * and `aria-current="page"`; inactive tabs hold a transparent border of the
 * same width so the underline flips on without any layout shift. Labels use
 * the display face (#38) for the same broadcast caps treatment as the table
 * column headers.
 */
export function ViewTabs({ value }: { value: StandingsView }) {
  const { t } = useTranslation()
  const analytics = useAnalytics()
  return (
    <div
      role="group"
      aria-label={t("home.viewTabsAria")}
      className="flex gap-6"
    >
      {TABS.map(({ view, to }) => {
        const active = view === value
        return (
          <Link
            key={view}
            to={to}
            aria-current={active ? "page" : undefined}
            // Fire the same view-switch event the old useState toggle did, but
            // only on an actual change — re-clicking the active tab is a no-op
            // navigation and shouldn't log a switch.
            onClick={() => {
              if (!active) {
                analytics.track("view.changed", { from: value, to: view })
              }
            }}
            className={cn(
              "font-display border-b-2 px-1 py-3 text-base tracking-wider uppercase transition-colors",
              active
                ? "border-brand text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {t(`home.tabs.${view}`)}
          </Link>
        )
      })}
    </div>
  )
}
