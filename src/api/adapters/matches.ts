import type { listMatchesV1TournamentsTournamentSlugMatchesGetResponse } from "@/api/generated/hooks/matches/matches"
import type { MatchPlayerRead, MatchRead } from "@/api/generated/types"
import type { Match, MatchesSnapshot, MatchPlayer } from "@/types"

/**
 * Adapter at the network boundary: maps generated `/matches` DTOs to the
 * UI-facing `MatchesSnapshot`. Adapter files are the only place generated API
 * types may be imported — API shape drift stops here (CLAUDE.md).
 */

/** Full response shape returned by the generated matches query hook. */
type MatchesResponse = listMatchesV1TournamentsTournamentSlugMatchesGetResponse

function toMatchPlayer(dto: MatchPlayerRead): MatchPlayer {
  return {
    profileId: dto.profile_id,
    civilizationId: dto.civilization_id,
    teamId: dto.team_id,
    // null while the match is in progress — the upstream fills these on
    // completion (see MatchPlayerRead).
    outcome: dto.outcome,
    oldRating: dto.old_rating,
    newRating: dto.new_rating,
    xpGained: dto.xp_gained,
  }
}

function toMatch(dto: MatchRead): Match {
  return {
    matchId: dto.match_id,
    mapName: dto.map_name,
    matchtypeId: dto.matchtype_id,
    leaderboardId: dto.leaderboard_id,
    startedAt: dto.started_at,
    completedAt: dto.completed_at,
    description: dto.description,
    state: dto.state,
    updatedAt: dto.updated_at,
    players: dto.players.map(toMatchPlayer),
  }
}

/**
 * Unwraps the orval `{ data, status }` envelope plus the API's
 * `{ last_polled_at, items }` list envelope, then remaps each match.
 *
 * Designed to be passed straight to TanStack Query's `select`, so the query
 * cache keeps the raw DTOs while components only ever see `MatchesSnapshot`.
 */
export function toMatchesSnapshot(response: MatchesResponse): MatchesSnapshot {
  // The fetch client throws on non-2xx, so a successful query only ever yields
  // the 200 shape; this guard narrows the generated union and stays defensive.
  if (response.status !== 200) {
    throw new Error(`Unexpected matches response status: ${response.status}`)
  }

  return {
    lastPolledAt: response.data.last_polled_at,
    matches: response.data.items.map(toMatch),
  }
}
