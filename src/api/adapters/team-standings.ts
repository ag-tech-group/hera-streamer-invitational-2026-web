import type { getTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { TeamStandingRow } from "@/api/generated/types"
import type { TeamStandingsRow, TeamStandingsSnapshot } from "@/types"

/**
 * Adapter at the network boundary: maps generated team-standings DTOs to the
 * UI-facing `TeamStandingsSnapshot`. Adapter files are the only place
 * generated API types may be imported — API shape drift stops here (CLAUDE.md).
 */

/** Full response shape returned by the generated team-standings query hook. */
type TeamStandingsResponse =
  getTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetResponse

function toTeamStandingsRow(dto: TeamStandingRow): TeamStandingsRow {
  return {
    teamId: dto.team_id,
    name: dto.name,
    initials: dto.initials,
    combinedRatingSum: dto.combined_rating_sum,
    combinedRatingAverage: dto.combined_rating_average,
    members: dto.members.map((member) => ({
      profileId: member.profile_id,
      alias: member.alias,
      currentRating: member.current_rating,
    })),
  }
}

/**
 * Unwraps the orval `{ data, status, headers }` envelope plus the API's
 * `{ last_polled_at, items }` list envelope, then remaps each team row.
 *
 * Designed to be passed straight to TanStack Query's `select`, so the query
 * cache keeps the raw DTOs while components only ever see
 * `TeamStandingsSnapshot`.
 */
export function toTeamStandingsSnapshot(
  response: TeamStandingsResponse
): TeamStandingsSnapshot {
  // `ky` throws on non-2xx, so a successful query only ever yields the 200
  // shape; this guard narrows the generated union and stays defensive.
  if (response.status !== 200) {
    throw new Error(
      `Unexpected team standings response status: ${response.status}`
    )
  }

  return {
    lastPolledAt: response.data.last_polled_at,
    rows: response.data.items.map(toTeamStandingsRow),
  }
}
