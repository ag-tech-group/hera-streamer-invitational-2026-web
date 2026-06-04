import { shadeByTeam } from "@/lib/team-colors"
import type { PositionPoint, StandingsHistorySnapshot } from "@/types"

/** One node of a position line — a player's standing at one bucket. */
export type BumpPoint = PositionPoint // { position, peakRating }

/** One player's position-over-time line, ready for the chart. */
export interface BumpSeries {
  tournamentPlayerId: number
  label: string
  /** Line colour: the player's team hue, shaded per teammate. */
  color: string
  /** One position per shared bucket — never null (#226). */
  points: BumpPoint[]
}

/**
 * Builds the position bump chart (#299) from the API's `/standings/history`.
 *
 * Each roster entity becomes a line of its leaderboard **position** over the
 * buckets — position-by-peak, straight from the API (the latest bucket equals
 * the live table). Lines are team-coloured, teammates shaded apart within the
 * hue, and ordered by current position so the legend reads like the standings.
 * Names join from the standings since the history payload carries no label.
 * The API ranks every entity at every bucket, so every line is continuous.
 */
export function toBumpSeries(
  history: StandingsHistorySnapshot,
  opts: {
    labelByTournamentPlayerId: Map<number, string>
    teamIdByTournamentPlayerId: Map<number, number>
    baseHexByTeamId: Map<number, string>
  }
): { buckets: string[]; series: BumpSeries[] } {
  // Chart only entities that are in the live standings — i.e. have a joined
  // label. The standings table is the canonical roster; `/standings/history`
  // can transiently surface entities that aren't current entrants (a mid-event
  // recompute, a swapped-out player), and without this they render as phantom
  // grey "—" lines/pills that aren't on the table (#326 follow-up). Requiring a
  // label keeps the chart's roster identical to the standings table's.
  const ordered = [...history.players]
    .filter(
      (p) =>
        p.points.length > 0 &&
        opts.labelByTournamentPlayerId.has(p.tournamentPlayerId)
    )
    .sort((a, b) => latestPosition(a.points) - latestPosition(b.points))

  const colorByPlayer = shadeByTeam(
    ordered.map((p) => p.tournamentPlayerId),
    opts.teamIdByTournamentPlayerId,
    opts.baseHexByTeamId
  )

  const series = ordered.map((p) => ({
    tournamentPlayerId: p.tournamentPlayerId,
    label: opts.labelByTournamentPlayerId.get(p.tournamentPlayerId) ?? "—",
    color: colorByPlayer.get(p.tournamentPlayerId)!,
    points: p.points,
  }))
  return { buckets: history.buckets, series }
}

/** A player's current (last-bucket) position; Infinity if they have no points. */
function latestPosition(points: PositionPoint[]): number {
  return points[points.length - 1]?.position ?? Infinity
}
