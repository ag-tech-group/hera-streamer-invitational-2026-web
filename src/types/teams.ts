/**
 * One member of a team, with their ratings and live-match status.
 *
 * Mirrors the per-player `StandingsRow` fields the standings table
 * already renders, so a member's flag and "live" indicator on the
 * teams tab match their row on the players tab in the same poll.
 */
export interface TeamMember {
  /**
   * Stable roster identity (#184): non-null even for placeholder / unlinked
   * members (where `profileId` is null), so team-member operations key on it
   * and it backs the React list key.
   */
  tournamentPlayerId: number
  /** AoE2 profile id, or `null` for a placeholder / unlinked roster member. */
  profileId: number | null
  /** Raw ladder alias, or `null` for an unlinked member with no ladder name. */
  alias: string | null
  /** ISO 3166-1 alpha-2 country code (lowercase), or null if unknown. */
  country: string | null
  /** Current tournament-leaderboard rating, or `null` for an unrated member. */
  currentRating: number | null
  /**
   * Lifetime ladder peak (`max_rating`) — the per-player figure the team's
   * combined-peak sum/average is built from (API #158), and the value shown on
   * the team pill. `null` for a brand-new account with no recorded peak, which
   * the pill renders as `—`; such a member is excluded from the combined sum.
   */
  peakRating: number | null
  /** Whether the player is in a live match right now. */
  inMatch: boolean
  /** ID of the live match they're in, or null. */
  liveMatchId: number | null
  /**
   * Whether this member is the team's captain (#235). At most one member per
   * team is captain; a team may have none. Drives the Captain badge on the
   * teams view — not shown on the per-player standings list.
   */
  isCaptain: boolean
}

/**
 * One team's row in the team standings, ready for display.
 *
 * UI-facing counterpart of the generated `TeamStandingRow` DTO: camelCased
 * and decoupled so API shape drift is absorbed by the adapter
 * (`src/api/adapters/team-standings.ts`) and never reaches components.
 */
export interface TeamStandingsRow {
  teamId: number
  /** Display name of the team. */
  name: string
  /** Short team initials — shown where a player row shows a country flag. */
  initials: string
  /**
   * Sum of the members' peak (lifetime `max_rating`) ratings; the metric teams
   * are ranked by (API #158). Members with no recorded peak are excluded.
   */
  combinedRatingSum: number
  /** Mean of the members' peak ratings (over those that have one). */
  combinedRatingAverage: number
  /** The team's roster, each member with their current and peak rating. */
  members: TeamMember[]
}

/**
 * A complete team-standings snapshot: the ranked teams plus the upstream poll
 * time the data reflects.
 */
export interface TeamStandingsSnapshot {
  /** ISO-8601 time the upstream data was last polled, or null if never. */
  lastPolledAt: string | null
  rows: TeamStandingsRow[]
}
