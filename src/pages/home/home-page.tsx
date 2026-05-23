import { useState } from "react"

import { Countdown } from "@/components/countdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { activeTournament } from "@/config/tournaments"
import { useLiveUpdates } from "@/hooks/use-live-updates"
import { useStandings } from "@/hooks/use-standings"
import { useTeamStandings } from "@/hooks/use-team-standings"
import { useTournament } from "@/hooks/use-tournament"
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

  // The "last updated" badge reflects whichever view is on screen.
  const activeData = view === "players" ? standings.data : teams.data

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
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
              {activeTournament.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeData ? (
            <LastUpdatedBadge lastPolledAt={activeData.lastPolledAt} />
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      {/*
       * Three-column layout on xl+: countdowns flank a centered table; on
       * narrower screens it stacks vertically. `min-w-0` on the center
       * lets the table shrink past the sidebars' fixed widths. Sidebars
       * use `variant="compact"`; both `<Countdown>`s self-hide when their
       * target is null or past, so the layout shrinks as milestones go by
       * (3-col pre-tournament → 2-col after start → just the table after
       * grand finals).
       *
       * Source order is Start → Finals → Table so mobile (flex-col) puts
       * both countdowns above the table — both are "what's coming next"
       * context that beats data the user already sees by scrolling. On
       * xl+ the `order-N` overrides put Finals on the right of the table
       * (Start 0 < Table 2 < Finals 3) while keeping the same JSX.
       */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <Countdown
          target={tournament.data?.startDate ?? null}
          label="Tournament starts in"
          variant="compact"
          className="xl:w-[280px] xl:shrink-0"
        />

        <Countdown
          target={tournament.data?.grandFinalsDate ?? null}
          label="Grand finals start in"
          variant="compact"
          className="xl:order-3 xl:w-[280px] xl:shrink-0"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-6 xl:order-2">
          <ViewTabs value={view} onChange={setView} />

          {view === "players" ? (
            <StandingsSection
              snapshot={standings.data}
              isPending={standings.isPending}
              isError={standings.isError}
              onRetry={() => void standings.refetch()}
            />
          ) : (
            <TeamsSection
              snapshot={teams.data}
              isPending={teams.isPending}
              isError={teams.isError}
              onRetry={() => void teams.refetch()}
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
  onRetry,
}: {
  snapshot: StandingsSnapshot | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  if (isPending) {
    return <StandingsTableSkeleton />
  }

  if (isError || !snapshot) {
    return <StandingsError onRetry={onRetry} />
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
  onRetry,
}: {
  snapshot: TeamStandingsSnapshot | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  if (isPending) {
    return <TeamsTableSkeleton />
  }

  if (isError || !snapshot) {
    return <TeamsError onRetry={onRetry} />
  }

  if (snapshot.rows.length === 0) {
    return <TeamsEmpty />
  }

  return <TeamsTable rows={snapshot.rows} />
}
