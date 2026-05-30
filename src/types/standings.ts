/** Outcome of a single completed match, used for a player's recent form. */
export type MatchResult = "win" | "loss"

/**
 * The team a player belongs to, folded onto their standings row — a compact
 * reference (id + display strings, no aggregates). Null when the player isn't
 * on a team. The richer per-team aggregates live on `TeamStandingsRow`.
 */
export interface StandingsTeam {
  teamId: number
  /** Display name of the team, shown on hover over the initials chip. */
  name: string
  /** Short team initials, shown as a chip in the standings Team column. */
  initials: string
}

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
  /** The player's team, or null if they aren't on one. */
  team: StandingsTeam | null
  /**
   * Player's current rating on the tournament leaderboard. `null` for
   * roster members who haven't played a ranked match yet — the API
   * surfaces them via a left join against `PlayerRating`, sorted to the
   * tail of the standings.
   */
  currentRating: number | null
  /**
   * Highest rating reached on the tournament leaderboard. `null` for the
   * same unrated-member reason as `currentRating`.
   */
  maxRating: number | null
  wins: number
  losses: number
  /** Current win/loss streak as reported by the upstream ladder. */
  streak: number
  /**
   * Outcomes of the player's most recent completed matches, most-recent
   * first, capped at 10 by the API. Empty when they have no completed match.
   */
  recentResults: MatchResult[]
  /** Matches the player has completed within the tournament's date window. */
  gamesPlayed: number
  /** Position on the leaderboard, or null if unranked. */
  rank: number | null
  /** Total tracked players on the leaderboard, or null if unknown. */
  rankTotal: number | null
  /** Whether the player is in a live match right now. */
  inMatch: boolean
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
