import { useState } from "react"

import { Countdown } from "@/components/countdown"
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
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="size-16 shrink-0" />
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">
              Live Standings
            </h1>
            <p className="text-muted-foreground text-sm">
              {activeTournament.name}
            </p>
          </div>
        </div>
        {activeData ? (
          <LastUpdatedBadge lastPolledAt={activeData.lastPolledAt} />
        ) : null}
      </header>

      <Countdown
        target={tournament.data?.startDate ?? null}
        label="Tournament starts in"
      />

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
