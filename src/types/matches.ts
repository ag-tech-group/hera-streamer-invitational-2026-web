/** Lifecycle state of a match (mirrors the API's `MatchState`). */
export type MatchState = "staging" | "in_progress" | "completed"

/** A player's result in a match — `null` while the match is still in progress. */
export type MatchOutcome = "win" | "loss"

/**
 * One player's row within a match, ready for display.
 *
 * UI-facing counterpart of the generated `MatchPlayerRead` DTO — camelCased and
 * decoupled so API shape drift is absorbed by the adapter
 * (`src/api/adapters/matches.ts`) and never reaches components.
 */
export interface MatchPlayer {
  /** AoE2 profile id of the player. */
  profileId: number
  /**
   * Relic civilization id. Resolved to a civ name (+ emblem) via a static map
   * for the civ pick/win chart (#302); the API doesn't send civ names.
   */
  civilizationId: number
  /** Which side the player was on within this match (relic team id). */
  teamId: number
  /** Win or loss, or `null` while the match is still in progress. */
  outcome: MatchOutcome | null
  /** Rating before the match, or `null` until it completes. */
  oldRating: number | null
  /** Rating after the match, or `null` until it completes. */
  newRating: number | null
  /** Ladder XP gained from the match. */
  xpGained: number
}

/**
 * One match plus its players, ready for display.
 *
 * UI-facing counterpart of the generated `MatchRead` DTO. Both sides' players
 * are always present, so a match card can render without a second request.
 */
export interface Match {
  matchId: number
  mapName: string
  /** Relic matchtype id (game mode). */
  matchtypeId: number
  /** Leaderboard the match counted on, or `null`. */
  leaderboardId: number | null
  /** ISO-8601 start time. */
  startedAt: string
  /** ISO-8601 completion time, or `null` if not finished. */
  completedAt: string | null
  description: string | null
  state: MatchState
  /** ISO-8601 time this row was last refreshed upstream. */
  updatedAt: string
  players: MatchPlayer[]
}

/**
 * A complete matches snapshot: the matches plus the upstream poll time the
 * data reflects.
 */
export interface MatchesSnapshot {
  /** ISO-8601 time the upstream data was last polled, or `null` if never. */
  lastPolledAt: string | null
  matches: Match[]
}
