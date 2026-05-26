/**
 * One member of a team, with their current rating and live-match status.
 *
 * Mirrors the per-player `StandingsRow` fields the standings table
 * already renders, so a member's flag and "live" indicator on the
 * teams tab match their row on the players tab in the same poll.
 */
export interface TeamMember {
  profileId: number
  alias: string
  /** ISO 3166-1 alpha-2 country code (lowercase), or null if unknown. */
  country: string | null
  currentRating: number
  /** Whether the player is in a live match right now. */
  inMatch: boolean
  /** ID of the live match they're in, or null. */
  liveMatchId: number | null
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
  /** Sum of the members' current ratings; the metric teams are ranked by. */
  combinedRatingSum: number
  /** Mean of the members' current ratings. */
  combinedRatingAverage: number
  /** The team's roster, each member with their current rating. */
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
