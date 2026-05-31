import { useCallback } from "react"

import { TournamentLayout } from "@/components/tournament-layout"
import type { StandingsView } from "@/components/view-tabs"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useLiveUpdates } from "@/hooks/use-live-updates"
import { useStandings } from "@/hooks/use-standings"
import { useTeamStandings } from "@/hooks/use-team-standings"
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
import type { StandingsSnapshot, TeamStandingsSnapshot } from "@/types"

export function HomePage({ view }: { view: StandingsView }) {
  useDocumentTitle()

  const standings = useStandings()
  // The team standings load lazily — only once the Teams view is opened.
  const teams = useTeamStandings(view === "teams")

  // Subscribe to the SSE nudge stream: each nudge invalidates the matching
  // query so the visible table refetches without a manual reload.
  useLiveUpdates()

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
    <TournamentLayout
      view={view}
      tabsTrailing={
        activeData ? (
          <LastUpdatedBadge lastPolledAt={activeData.lastPolledAt} />
        ) : activeIsPending ? (
          <LastUpdatedBadgeSkeleton />
        ) : null
      }
    >
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
    </TournamentLayout>
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
