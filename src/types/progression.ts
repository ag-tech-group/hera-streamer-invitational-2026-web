/** A single rating observation: a completed-match rating at a point in time. */
export interface RatingObservation {
  /** ISO timestamp of the completed match this rating was recorded at. */
  completedAt: string
  rating: number
}

/**
 * One player's rating-over-time series for the tournament, oldest-first.
 * Mirrors the API's `PlayerProgression`; players with no completed-match
 * history on the leaderboard are absent from the series list entirely.
 */
export interface PlayerSeries {
  /**
   * Stable per-series identity (#187) — the key the chart and the display-name
   * join use, matching the rest of the unified read surface. A series only
   * exists for a player with rated matches, so it's always a linked entrant
   * (hence `profileId` is non-null here too); we still key on this for
   * consistency, not because `profileId` could be missing.
   */
  tournamentPlayerId: number
  /** Raw ladder profile id (enrichment, like `alias`) — non-null for a series. */
  profileId: number
  alias: string
  points: RatingObservation[]
}

/**
 * UI-facing progression snapshot — the per-player rating series the `/stats`
 * charts plot. Counterpart of the generated `ListEnvelope[PlayerProgression]`,
 * camelCased and decoupled so API shape drift is absorbed by the adapter
 * (`src/api/adapters/progression.ts`) and never reaches components.
 */
export interface ProgressionSnapshot {
  lastPolledAt: string | null
  series: PlayerSeries[]
}
