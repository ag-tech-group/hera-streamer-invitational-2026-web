/**
 * One player's row in the standings, ready for display.
 *
 * UI-facing counterpart of the generated `StandingRow` DTO: camelCased and
 * decoupled so that API shape drift is absorbed by the adapter
 * (`src/api/adapters/standings.ts`) and never reaches components.
 */
export interface StandingsRow {
  profileId: number
  alias: string
  /** ISO 3166-1 alpha-2 country code (lowercase), or null if unknown. */
  country: string | null
  currentRating: number
  maxRating: number
  wins: number
  losses: number
  /** Current win/loss streak as reported by the upstream ladder. */
  streak: number
  /** Position on the leaderboard, or null if unranked. */
  rank: number | null
  /** Total tracked players on the leaderboard, or null if unknown. */
  rankTotal: number | null
  /** ISO-8601 timestamp of the player's most recent match, or null. */
  lastMatchAt: string | null
  /** ISO-8601 timestamp of when this row was last refreshed upstream. */
  updatedAt: string
}

/**
 * A complete standings snapshot for one leaderboard: the ranked rows plus the
 * upstream poll time the data reflects.
 */
export interface StandingsSnapshot {
  /** ISO-8601 time the upstream data was last polled, or null if never. */
  lastPolledAt: string | null
  rows: StandingsRow[]
}
