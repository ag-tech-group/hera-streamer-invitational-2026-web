import type { getStandingsV1TournamentsTournamentSlugStandingsGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { StandingRow } from "@/api/generated/types"
import type { StandingsRow, StandingsSnapshot } from "@/types"

/**
 * Adapter at the network boundary: maps generated standings DTOs to the
 * UI-facing `StandingsSnapshot`. This is the *only* file allowed to import
 * generated API types — drift in the API shape stops here (see CLAUDE.md).
 */

/** Full response shape returned by the generated standings query hook. */
type StandingsResponse =
  getStandingsV1TournamentsTournamentSlugStandingsGetResponse

function toStandingsRow(dto: StandingRow): StandingsRow {
  return {
    profileId: dto.profile_id,
    alias: dto.alias,
    country: dto.country,
    currentRating: dto.current_rating,
    maxRating: dto.max_rating,
    wins: dto.wins,
    losses: dto.losses,
    streak: dto.streak,
    recentResults: dto.recent_results,
    gamesPlayed: dto.tournament_record.games_played,
    rank: dto.rank,
    rankTotal: dto.rank_total,
    inMatch: dto.in_match,
    lastMatchAt: dto.last_match_at,
    updatedAt: dto.updated_at,
  }
}

/**
 * Unwraps the orval `{ data, status, headers }` envelope plus the API's
 * `{ last_polled_at, items }` list envelope, then remaps each row.
 *
 * Designed to be passed straight to TanStack Query's `select`, so the query
 * cache keeps the raw DTOs (which SSE updates will write later) while
 * components only ever see `StandingsSnapshot`.
 */
export function toStandingsSnapshot(
  response: StandingsResponse
): StandingsSnapshot {
  // `ky` throws on non-2xx, so a successful query only ever yields the 200
  // shape; this guard narrows the generated union and stays defensive.
  if (response.status !== 200) {
    throw new Error(`Unexpected standings response status: ${response.status}`)
  }

  return {
    lastPolledAt: response.data.last_polled_at,
    rows: response.data.items.map(toStandingsRow),
  }
}
