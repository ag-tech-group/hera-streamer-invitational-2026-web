import { useCallback, useState } from "react"

import { SidePanel } from "@/components/side-panel"
import { TournamentHero } from "@/components/tournament-hero"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useLiveUpdates } from "@/hooks/use-live-updates"
import { useStandings } from "@/hooks/use-standings"
import { useTeamStandings } from "@/hooks/use-team-standings"
import { useTournament } from "@/hooks/use-tournament"
import { useAnalytics } from "@/lib/analytics"
import {
  LastUpdatedBadge,
  LastUpdatedBadgeSkeleton,
} from "@/pages/home/last-updated-badge"
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
import { TeamsView, TeamsViewSkeleton } from "@/pages/home/teams-view"
import { ViewTabs, type StandingsView } from "@/pages/home/view-tabs"
import type { StandingsSnapshot, TeamStandingsSnapshot } from "@/types"

export function HomePage({ view }: { view: StandingsView }) {
  useDocumentTitle()

  const standings = useStandings()
  // The team standings load lazily — only once the Teams view is opened.
  const teams = useTeamStandings(view === "teams")

  // Subscribe to the SSE nudge stream: each nudge invalidates the matching
  // query so the visible table refetches without a manual reload.
  useLiveUpdates()

  // Has the tournament started? Gates the Games + Recent columns — the API
  // only populates them within the tournament's date window, so pre-start
  // they're always zero / empty and showing them reads as dead chrome. (The
  // left column's countdown→active-panel swap lives in `SidePanel` now.)
  // Null start date counts as "not started"; `mountedAtMs` is captured once
  // via `useState`'s lazy initializer so `Date.now()` stays out of the render
  // pass (react-hooks/purity), and a manual reload re-evaluates it.
  const tournament = useTournament()
  const [mountedAtMs] = useState(() => Date.now())
  const tournamentStarted = tournament.data?.startDate
    ? new Date(tournament.data.startDate).getTime() <= mountedAtMs
    : false

  const analytics = useAnalytics()

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
  // Loading state for the same view, so the badge slot can render a
  // skeleton instead of an empty hole while the snapshot is in flight.
  const activeIsPending =
    view === "players" ? standings.isPending : teams.isPending

  return (
    <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-6 p-8">
      <TournamentHero />

      {/*
       * Two-column flex layout on xl+; stacks vertically on smaller
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
       * Side-by-side kicks in at `xl:` (1280px). The prior `2xl:` (1536px)
       * threshold left common laptop viewports stacked — 14" MBP at default
       * scaling reports 1512 CSS px, 13" MBA reports 1470, both below 1536
       * despite ample horizontal space — so the intended side-by-side never
       * showed for most viewers. `xl` covers those laptops while leaving the
       * 1024–1279 range (landscape tablets, partially-maximised browser
       * windows) stacked, where the cards column at `lg` would otherwise
       * compress to a cramped ~240px.
       */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <SidePanel />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/*
           * Tabs row with the "last updated" badge right-aligned via
           * `ml-auto`. `flex-wrap` lets the badge drop to its own line on
           * narrow viewports where tabs + badge can't share one row, and
           * `ml-auto` keeps the badge on the right regardless of wrap.
           */}
          <div className="flex flex-wrap items-center gap-3">
            <ViewTabs value={view} />
            <div className="ml-auto">
              {activeData ? (
                <LastUpdatedBadge lastPolledAt={activeData.lastPolledAt} />
              ) : activeIsPending ? (
                // Skeleton while the snapshot is in flight so the badge
                // slot doesn't pop into existence once the first poll
                // lands — same pill chrome, same height.
                <LastUpdatedBadgeSkeleton />
              ) : null}
            </div>
          </div>
          {view === "players" ? (
            <StandingsSection
              snapshot={standings.data}
              isPending={standings.isPending}
              isError={standings.isError}
              error={standings.error}
              onRetry={handleRetryStandings}
              tournamentStarted={tournamentStarted}
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
  tournamentStarted,
}: {
  snapshot: StandingsSnapshot | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  tournamentStarted: boolean
}) {
  if (isPending) {
    return <StandingsTableSkeleton tournamentStarted={tournamentStarted} />
  }

  if (isError || !snapshot) {
    return <StandingsError error={error} onRetry={onRetry} />
  }

  if (snapshot.rows.length === 0) {
    return <StandingsEmpty />
  }

  return (
    <StandingsTable
      rows={snapshot.rows}
      tournamentStarted={tournamentStarted}
    />
  )
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
    return <TeamsViewSkeleton />
  }

  if (isError || !snapshot) {
    return <TeamsError error={error} onRetry={onRetry} />
  }

  if (snapshot.rows.length === 0) {
    return <TeamsEmpty />
  }

  return <TeamsView rows={snapshot.rows} />
}
