import { useCallback, useState } from "react"

import { Countdown } from "@/components/countdown"
import { HostLinksCard } from "@/components/host-links-card"
import { ThemeToggle } from "@/components/theme-toggle"
import { activeTournament } from "@/config/tournaments"
import { useLiveUpdates } from "@/hooks/use-live-updates"
import { useStandings } from "@/hooks/use-standings"
import { useTeamStandings } from "@/hooks/use-team-standings"
import { useTournament } from "@/hooks/use-tournament"
import { useAnalytics } from "@/lib/analytics"
import { LastUpdatedBadge } from "@/pages/home/last-updated-badge"
import {
  StandingsEmpty,
  StandingsError,
  TeamsEmpty,
  TeamsError,
} from "@/pages/home/standings-states"
import {
  StandingsTable,
  StandingsTableSkeleton,
} from "@/pages/home/standings-table"
import { TeamsTable, TeamsTableSkeleton } from "@/pages/home/teams-table"
import { ViewTabs, type StandingsView } from "@/pages/home/view-tabs"
import type { StandingsSnapshot, TeamStandingsSnapshot } from "@/types"

export function HomePage() {
  const [view, setView] = useState<StandingsView>("players")

  const standings = useStandings()
  // The team standings load lazily — only once the Teams view is opened.
  const teams = useTeamStandings(view === "teams")

  // Subscribe to the SSE nudge stream: each nudge invalidates the matching
  // query so the visible table refetches without a manual reload.
  useLiveUpdates()

  // Tournament metadata (start/end dates) for the hero countdown. The
  // dates live in the DB and are served on `TournamentRead`; the countdown
  // renders nothing until a date is set.
  const tournament = useTournament()

  const analytics = useAnalytics()

  // Track view-tab switches so we can see which standings (Players vs Teams)
  // is the dominant view in production.
  const handleViewChange = useCallback(
    (next: StandingsView) => {
      analytics.track("view.changed", { from: view, to: next })
      setView(next)
    },
    [analytics, view]
  )

  // Track retry-button clicks separately per view — a spike in retries on
  // either side is an early signal the relevant API path is unhealthy.
  const handleRetryStandings = useCallback(() => {
    analytics.track("standings.retry", { view: "players" })
    void standings.refetch()
  }, [analytics, standings])

  const handleRetryTeams = useCallback(() => {
    analytics.track("standings.retry", { view: "teams" })
    void teams.refetch()
  }, [analytics, teams])

  // The "last updated" badge reflects whichever view is on screen.
  const activeData = view === "players" ? standings.data : teams.data

  return (
    <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-6 p-8">
      <header className="border-border flex flex-wrap items-start justify-between gap-3 border-b-2 pb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="size-16 shrink-0" />
          <div className="flex flex-col gap-1">
            {/*
             * Drops `font-bold` because Bebas Neue ships only weight 400 —
             * forcing a synthetic 700 produces an ugly emboldened glyph.
             */}
            <h1 className="font-display text-4xl tracking-wide">
              Live Standings
            </h1>
            <p className="text-muted-foreground text-sm">
              <a
                href="https://store.steampowered.com/app/813780/Age_of_Empires_II_Definitive_Edition/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline-offset-2 transition-colors hover:underline"
              >
                Age of Empires 2: Definitive Edition
              </a>{" "}
              live rankings
            </p>
          </div>
        </div>
        {/*
         * `w-full justify-between` makes the badge sit at the left and the
         * theme toggle at the right when the header wraps to a second row
         * on narrow viewports. At `sm:` and up the header fits on one row
         * so the inner div snaps back to content-width.
         */}
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          {activeData ? (
            <LastUpdatedBadge lastPolledAt={activeData.lastPolledAt} />
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      {/*
       * Two-column flex layout on 2xl+; stacks vertically on smaller
       * screens. Left column carries the stacked context cards (countdowns
       * + host links); right column carries the view tabs and the
       * standings table. Each column flows top-down from its own top, so
       * the topmost card aligns with the tabs (not the table). `min-w-0`
       * on the right column lets the table shrink past its content's
       * intrinsic width without blowing out the layout.
       *
       * Source order is [cards block] → [tabs+table block] so mobile
       * (flex-col) puts the context cards above the standings — "what's
       * coming next" and "where to follow the host" both beat data the
       * user already sees by scrolling.
       *
       * Side-by-side kicks in at `2xl:` (1536px) because the cards plus
       * a usable table only fit comfortably starting around there; below
       * that, stacked gives the table the full page width.
       */}
      <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start">
        <div className="flex flex-col gap-6 2xl:w-1/4 2xl:shrink-0">
          <Countdown
            target={tournament.data?.startDate ?? null}
            label="Tournament starts in"
            variant="compact"
          />
          <Countdown
            target={tournament.data?.grandFinalsDate ?? null}
            label="Grand finals start in"
            variant="compact"
          />
          <HostLinksCard
            label={activeTournament.hostLabel}
            links={activeTournament.hostLinks}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <ViewTabs value={view} onChange={handleViewChange} />
          {view === "players" ? (
            <StandingsSection
              snapshot={standings.data}
              isPending={standings.isPending}
              isError={standings.isError}
              error={standings.error}
              onRetry={handleRetryStandings}
            />
          ) : (
            <TeamsSection
              snapshot={teams.data}
              isPending={teams.isPending}
              isError={teams.isError}
              error={teams.error}
              onRetry={handleRetryTeams}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Picks the players standings view that matches the current query state.
 * Order matters: a request still in flight must not surface as empty or
 * error, and a failed request must not be mistaken for an empty leaderboard.
 */
function StandingsSection({
  snapshot,
  isPending,
  isError,
  error,
  onRetry,
}: {
  snapshot: StandingsSnapshot | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
}) {
  if (isPending) {
    return <StandingsTableSkeleton />
  }

  if (isError || !snapshot) {
    return <StandingsError error={error} onRetry={onRetry} />
  }

  if (snapshot.rows.length === 0) {
    return <StandingsEmpty />
  }

  return <StandingsTable rows={snapshot.rows} />
}

/** The teams counterpart of `StandingsSection`, with the same state precedence. */
function TeamsSection({
  snapshot,
  isPending,
  isError,
  error,
  onRetry,
}: {
  snapshot: TeamStandingsSnapshot | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
}) {
  if (isPending) {
    return <TeamsTableSkeleton />
  }

  if (isError || !snapshot) {
    return <TeamsError error={error} onRetry={onRetry} />
  }

  if (snapshot.rows.length === 0) {
    return <TeamsEmpty />
  }

  return <TeamsTable rows={snapshot.rows} />
}
