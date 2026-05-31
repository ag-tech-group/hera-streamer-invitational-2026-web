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
  /**
   * Total prize pool, in integer minor units of the build's display
   * currency (cents for USD/EUR/etc.) — `5000.00` is stored as `500000`.
   * Mutable metadata the tournament owner edits live via the admin
   * surface; `null` when no prize pool has been set, in which case the
   * `PrizePoolCard` collapses out of the sidebar (#156).
   */
  prizePoolCents: number | null
  /**
   * Whether the tournament host's broadcast channel is live right now
   * (#149 → the API's `host_stream_live`). Drives the pulsing "Live" badge on
   * `HostLinksCard`. Defaults to `false` when the API omits the field (it's
   * optional) or no host channel is configured server-side.
   */
  hostStreamLive: boolean
  /** ISO-8601 timestamp when the tournament record was created. */
  createdAt: string
}
