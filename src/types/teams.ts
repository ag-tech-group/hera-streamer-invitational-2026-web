/** One member of a team, with their current rating. */
export interface TeamMember {
  profileId: number
  alias: string
  currentRating: number
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
