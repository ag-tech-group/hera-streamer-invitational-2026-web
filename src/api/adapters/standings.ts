import type { getStandingsV1TournamentsTournamentSlugStandingsGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type {
  StandingRow,
  StandingRowPresentation,
} from "@/api/generated/types"
import type {
  PlayerPresentation,
  StandingsRow,
  StandingsSnapshot,
} from "@/types"

/**
 * Adapter at the network boundary: maps generated standings DTOs to the
 * UI-facing `StandingsSnapshot`. Adapter files are the only place generated
 * API types may be imported — drift in the API shape stops here (CLAUDE.md).
 */

/** Full response shape returned by the generated standings query hook. */
type StandingsResponse =
  getStandingsV1TournamentsTournamentSlugStandingsGetResponse

function toStandingsRow(dto: StandingRow): StandingsRow {
  return {
    profileId: dto.profile_id,
    alias: dto.alias,
    country: dto.country,
    team: dto.team
      ? {
          teamId: dto.team.team_id,
          name: dto.team.name,
          initials: dto.team.initials,
        }
      : null,
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
    presentation: toPlayerPresentation(dto.presentation),
    streamLive: dto.stream_live,
  }
}

/**
 * The API treats `presentation` as an opaque record (`Record<string,
 * unknown>` in the generated type), so the adapter is the one place that
 * narrows the bag down to the keys the frontend knows about. Anything else
 * the bag carries is dropped — by design, since the API has no schema on it
 * and we don't want unrecognised keys leaking into UI components.
 */
function toPlayerPresentation(
  raw: StandingRowPresentation
): PlayerPresentation {
  if (!raw || typeof raw !== "object") return {}
  const bag = raw as Record<string, unknown>
  const out: PlayerPresentation = {}
  if (typeof bag.displayName === "string") out.displayName = bag.displayName
  if (typeof bag.flag === "string") out.flag = bag.flag
  if (Array.isArray(bag.streamUrls)) {
    out.streamUrls = bag.streamUrls.filter(
      (u): u is string => typeof u === "string"
    )
  }
  if (typeof bag.bio === "string") out.bio = bag.bio
  return out
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
