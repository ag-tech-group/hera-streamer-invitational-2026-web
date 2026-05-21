import { activeTournament } from "@/config/tournaments"
import { useLiveUpdates } from "@/hooks/use-live-updates"
import { useStandings } from "@/hooks/use-standings"
import { LastUpdatedBadge } from "@/pages/home/last-updated-badge"
import { StandingsEmpty, StandingsError } from "@/pages/home/standings-states"
import {
  StandingsTable,
  StandingsTableSkeleton,
} from "@/pages/home/standings-table"
import type { StandingsSnapshot } from "@/types"

export function HomePage() {
  const { data, isPending, isError, refetch } = useStandings()

  // Subscribe to the SSE nudge stream: each nudge invalidates the matching
  // query so this page's standings refetch without a manual reload.
  useLiveUpdates()

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Live Standings</h1>
          <p className="text-muted-foreground text-sm">
            {activeTournament.name}
          </p>
        </div>
        {data ? <LastUpdatedBadge lastPolledAt={data.lastPolledAt} /> : null}
      </header>
      <StandingsSection
        snapshot={data}
        isPending={isPending}
        isError={isError}
        onRetry={() => void refetch()}
      />
    </div>
  )
}

/**
 * Picks the standings view that matches the current query state. Order matters:
 * a request still in flight must not surface as empty or error, and a failed
 * request must not be mistaken for an empty leaderboard.
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
