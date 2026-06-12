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
   * ISO-8601 end of the rated window — for this event, the ladder-race
   * end, NOT the grand finals (renamed from `grand_finals_date`;
   * aoe2-live-standings-api#277/#279 reversed #76 once the playoffs
   * proved the two diverge). The countdown target while the race runs;
   * the playoffs/grand-finals schedule is display data and comes from
   * the tournament `presentation` bag instead.
   */
  endDate: string | null
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
  /**
   * Host broadcast channel URLs the server-side broadcast-live poller
   * resolves to compute {@link hostStreamLive} (#149). The tournament owner
   * edits these in the admin tournament-details form (#225); the API caps
   * the list at 5. NOT what the promo card displays — `HostLinksCard`
   * renders its links from build config (`src/config/tournaments/<slug>.ts`);
   * this is purely the liveness-detection input. Empty when none configured.
   */
  hostStreamUrls: string[]
  /** ISO-8601 timestamp when the tournament record was created. */
  createdAt: string
}
