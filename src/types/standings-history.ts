/**
 * Tournament standings reconstructed over time (#226), served by the API's
 * `/standings/history` endpoint as a true bump chart. Position is by **all-time
 * peak as of each bucket** (`max(carried-in baseline, in-window peak-so-far)` →
 * current → name), so the **latest bucket equals the live standings table** and
 * past buckets stay stable.
 *
 * Buckets are as-of-T snapshots emitted at a daily anchor **plus at every
 * position shift** (stamped at the match-completion time that caused it), so
 * the axis carries each real movement, not just daily samples. Every roster
 * entity holds a position at every bucket — including unrated members, parked
 * at the name-sorted tail — so there are **no null points**.
 *
 * UI-facing counterparts of the generated `StandingsHistory` DTOs, camelCased
 * and decoupled at the adapter boundary (`src/api/adapters/standings-history.ts`).
 */

/** A player's leaderboard position + peak rating at one bucket. */
export interface PositionPoint {
  /** Position by peak (1 = leader). */
  position: number
  /** All-time peak as of this bucket, or `null` for an unrated entrant. */
  peakRating: number | null
}

/** One entrant's position-over-time, aligned to the shared buckets. */
export interface PlayerHistory {
  tournamentPlayerId: number
  /** AoE2 profile id, or `null` for an unlinked/unrated roster member. */
  profileId: number | null
  /**
   * Resolved display label (host `displayName` override applied server-side,
   * #243) — the legend reads from this, no `/standings` join needed.
   */
  name: string
  /** `points[i]` is the standing at `buckets[i]` — one per bucket, never null. */
  points: PositionPoint[]
}

/** A team's position + combined peak elo at one bucket. */
export interface TeamPositionPoint {
  position: number
  combinedPeakElo: number
}

/** One team's combined-elo-over-time, aligned to the shared buckets. */
export interface TeamHistory {
  teamId: number
  /** Team display name — the legend reads from this, no `/teams/standings` join. */
  name: string
  points: TeamPositionPoint[]
}

/** A standings-history snapshot: the shared bucket axis plus per-entity series. */
export interface StandingsHistorySnapshot {
  lastPolledAt: string | null
  /** Shared time axis — ISO timestamps (daily anchors + per-shift), oldest first. */
  buckets: string[]
  players: PlayerHistory[]
  teams: TeamHistory[]
}
