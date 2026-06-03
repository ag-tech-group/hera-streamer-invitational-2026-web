import { lightenHex } from "@/lib/team-colors"
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

/** Lightening spread across a team's players, base hue → lightest. */
const SHADE_MAX = 0.45
/** Fallback when a player isn't found on any team roster. */
const NEUTRAL_HEX = "#94a3b8"

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
  const ordered = [...history.players]
    .filter((p) => p.points.length > 0)
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

/**
 * Assigns each shown player a colour: their team's base hue for the
 * best-ranked teammate, lightening across the rest so same-team lines separate.
 * `shownIds` arrives ordered by current position, so the team's leader keeps the
 * fullest hue.
 */
function shadeByTeam(
  shownIds: number[],
  teamIdByTournamentPlayerId: Map<number, number>,
  baseHexByTeamId: Map<number, string>
): Map<number, string> {
  const teammates = new Map<number, number[]>()
  for (const id of shownIds) {
    const teamId = teamIdByTournamentPlayerId.get(id) ?? -1
    const group = teammates.get(teamId)
    if (group) group.push(id)
    else teammates.set(teamId, [id])
  }
  const color = new Map<number, string>()
  for (const [teamId, ids] of teammates) {
    const base = baseHexByTeamId.get(teamId) ?? NEUTRAL_HEX
    ids.forEach((id, k) => {
      color.set(
        id,
        ids.length > 1
          ? lightenHex(base, (k / (ids.length - 1)) * SHADE_MAX)
          : base
      )
    })
  }
  return color
}
