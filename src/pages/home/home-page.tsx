import { activeTournament } from "@/config/tournaments"
import { useStandings } from "@/hooks/use-standings"
import type { StandingsRow, StandingsSnapshot } from "@/types"

export function HomePage() {
  const { data, isPending, isError } = useStandings()

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-8">
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
 * Picks the standings view for the current query state. The treatment here is
 * deliberately plain — the polished table, skeleton, and states land in the
 * static-standings-table PR (issue #3).
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

function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-muted-foreground border-b text-left">
          <th className="py-2 pr-4 font-medium">Rank</th>
          <th className="py-2 pr-4 font-medium">Player</th>
          <th className="py-2 text-right font-medium">Rating</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.profileId} className="border-b">
            <td className="py-2 pr-4 tabular-nums">{row.rank ?? "—"}</td>
            <td className="py-2 pr-4">{row.alias}</td>
            <td className="py-2 text-right tabular-nums">
              {row.currentRating}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
