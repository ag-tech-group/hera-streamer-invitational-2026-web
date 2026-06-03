/**
 * Civilization pick/win aggregation for the tournament's entrants (#302),
 * served by the API's `/civ-stats` endpoint (it counts entrants' completed
 * matches over the whole tournament window, opponents excluded — what the
 * frontend couldn't do from the capped `/matches` list).
 *
 * UI-facing counterparts of the generated `CivStats` / `CivStat` /
 * `PlayerCivStats` DTOs, camelCased and decoupled at the adapter boundary
 * (`src/api/adapters/civ-stats.ts`).
 */

/** One civilization's pick/win counts. */
export interface CivCount {
  /** Relic civilization id — resolve to name/emblem via `civById`. */
  civId: number
  picks: number
  wins: number
}

/** One entrant's per-civ pick/win breakdown (for the per-player view). */
export interface PlayerCivCounts {
  tournamentPlayerId: number
  profileId: number
  /** This player's civs, picks-desc from the API. */
  civs: CivCount[]
}

/** A civ-stats snapshot: overall + per-player counts, plus the poll time. */
export interface CivStatsSnapshot {
  lastPolledAt: string | null
  /** Each civ's counts summed across all entrants. */
  overall: CivCount[]
  /** The same counts broken down per entrant. */
  byPlayer: PlayerCivCounts[]
}
