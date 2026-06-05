import { NEUTRAL_HEX, shadeByTeam } from "@/lib/team-colors"
import type { StandingsHistorySnapshot } from "@/types"

/** Which set of bars the race animates. */
export type EloRaceMode = "teams" | "players"

/** One racer: a stable identity plus its value at each shared bucket. */
export interface RaceEntity {
  /** Stable id (teamId or tournamentPlayerId) — the bar's identity across frames. */
  id: number
  label: string
  color: string
  /**
   * One value per shared bucket — a team's combined peak elo, or a player's peak
   * rating — aligned to `EloRace.buckets`. Never null: a player's pre-rating
   * buckets are 0 so the bar grows in from the baseline.
   */
  values: number[]
}

/** A bar-chart race ready to animate: a shared timeline plus fixed-order racers. */
export interface EloRace {
  /** Shared ISO bucket axis (oldest-first) — the race's frames. */
  buckets: string[]
  /**
   * Racers in a fixed order (current leader first). The order is stable across
   * frames — only `values` change per frame, and echarts' `realtimeSort`
   * animates the visual reordering.
   */
  entities: RaceEntity[]
}

/** Last (current) value of a per-bucket series; 0 when empty. */
function latest(values: number[]): number {
  return values.length > 0 ? values[values.length - 1] : 0
}

/**
 * Team combined-peak-elo race (#301), built from `/standings/history`'s `teams`
 * series — the half the position bump chart (#299) leaves unused. Each team's
 * `combinedPeakElo` per bucket becomes one bar's timeline. The API already
 * aggregates per bucket and shares the axis, so this is pure shaping: no
 * client-side bucketing. Bars are labelled from the history payload's `name`
 * (#243) and team-coloured via the `teamId → hex` map the boards use, ordered
 * current-leader-first.
 */
export function toTeamRace(
  history: StandingsHistorySnapshot,
  opts: {
    teamHexByTeamId: Map<number, string>
  }
): EloRace {
  const entities = history.teams
    .map((team) => ({
      id: team.teamId,
      label: team.name,
      color: opts.teamHexByTeamId.get(team.teamId) ?? NEUTRAL_HEX,
      values: team.points.map((p) => p.combinedPeakElo),
    }))
    .sort((a, b) => latest(b.values) - latest(a.values))
  return { buckets: history.buckets, entities }
}

/** A player's current (last-bucket) peak, or null if never rated. */
function latestPeak(points: { peakRating: number | null }[]): number | null {
  return points.length > 0 ? points[points.length - 1].peakRating : null
}

/**
 * Per-player peak-rating race (#301), built from `/standings/history`'s
 * `players` series. Only rated entrants race — a roster member with no recorded
 * peak (the bench) would otherwise sit as a permanent zero bar — mirroring the
 * rating chart's rated-only field. Roster membership also keeps the field
 * identical to the table's, dropping any transient non-entrant the history
 * endpoint surfaces (the #326 phantom-row guard) — the resolved `name` can't do
 * that filtering, since phantoms carry one too. Labels come straight from the
 * history payload's `name` (#243). A null peak before a player's first rated
 * match maps to 0, so their bar animates in from the baseline when they enter.
 * Team-coloured with teammates shaded apart (the helper shared with the bump
 * chart), ordered current-leader-first.
 */
export function toPlayerRace(
  history: StandingsHistorySnapshot,
  opts: {
    /** Current-roster ids — the #326 phantom guard, not a label source. */
    rosterIds: Set<number>
    teamIdByTournamentPlayerId: Map<number, number>
    baseHexByTeamId: Map<number, string>
  }
): EloRace {
  const ordered = history.players
    .filter(
      (p) =>
        opts.rosterIds.has(p.tournamentPlayerId) && latestPeak(p.points) != null
    )
    .sort((a, b) => (latestPeak(b.points) ?? 0) - (latestPeak(a.points) ?? 0))

  const colorByPlayer = shadeByTeam(
    ordered.map((p) => p.tournamentPlayerId),
    opts.teamIdByTournamentPlayerId,
    opts.baseHexByTeamId
  )

  const entities = ordered.map((p) => ({
    id: p.tournamentPlayerId,
    label: p.name,
    color: colorByPlayer.get(p.tournamentPlayerId)!,
    values: p.points.map((pt) => pt.peakRating ?? 0),
  }))
  return { buckets: history.buckets, entities }
}
