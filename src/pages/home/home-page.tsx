import { activeTournament } from "@/config/tournaments"
import { useStandings } from "@/hooks/use-standings"
import { StandingsTable } from "@/pages/home/standings-table"
import type { StandingsSnapshot } from "@/types"

export function HomePage() {
  const { data, isPending, isError } = useStandings()

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Live Standings</h1>
        <p className="text-muted-foreground text-sm">{activeTournament.name}</p>
      </header>
      <StandingsSection
        snapshot={data}
        isPending={isPending}
        isError={isError}
      />
    </div>
  )
}

/**
 * Picks the standings view for the current query state. The loading skeleton
 * and the polished empty/error states land in later commits of issue #3 — for
 * now those branches stay as plain text.
 */
function StandingsSection({
  snapshot,
  isPending,
  isError,
}: {
  snapshot: StandingsSnapshot | undefined
  isPending: boolean
  isError: boolean
}) {
  if (isPending) {
    return <p className="text-muted-foreground text-sm">Loading standings…</p>
  }

  if (isError || !snapshot) {
    return (
      <p className="text-muted-foreground text-sm">Couldn't load standings.</p>
    )
  }

  if (snapshot.rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No standings to show yet.</p>
    )
  }

  return <StandingsTable rows={snapshot.rows} />
}
