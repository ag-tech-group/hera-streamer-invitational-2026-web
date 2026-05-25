/**
 * UI-facing view of the API's tournament resource.
 *
 * CamelCased counterpart of the generated `TournamentRead` DTO, decoupled
 * via the adapter (`src/api/adapters/tournament.ts`) so API shape drift
 * stops at the network boundary (CLAUDE.md).
 *
 * Distinct from the build-time `Tournament` config in `tournament.ts`: this
 * is the live record served by `GET /v1/tournaments/{slug}`, including the
 * tournament dates that drive the start/end countdowns (#33, #17).
 */
export interface TournamentInfo {
  id: number
  slug: string
  /** Display name of the tournament, set in the DB. */
  name: string
  /** Leaderboard this tournament is tracked against. */
  leaderboardId: number
  /** ISO-8601 start timestamp, or null if not yet set in the DB. */
  startDate: string | null
  /**
   * ISO-8601 grand-finals timestamp (#17). Also the tournament-window
   * upper bound now that `end_date` is gone (aoe2-live-standings-api#76).
   */
  grandFinalsDate: string | null
  /** ISO-8601 timestamp when the tournament record was created. */
  createdAt: string
}
