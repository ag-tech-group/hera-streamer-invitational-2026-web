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
