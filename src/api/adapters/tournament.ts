import type { getTournamentDetailV1TournamentsTournamentSlugGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { TournamentInfo } from "@/types"

/**
 * Adapter at the network boundary: maps the generated `TournamentRead` DTO
 * to the UI-facing `TournamentInfo`. Adapter files are the only place
 * generated API types may be imported — drift in the API shape stops here
 * (CLAUDE.md).
 */

/** Full response shape returned by the generated tournament query hook. */
type TournamentResponse =
  getTournamentDetailV1TournamentsTournamentSlugGetResponse

/**
 * Unwraps the orval `{ data, status, headers }` envelope and remaps the
 * tournament DTO to camelCased UI fields.
 *
 * Designed to be passed straight to TanStack Query's `select`, so the query
 * cache keeps the raw DTO while components only ever see `TournamentInfo`.
 */
export function toTournamentInfo(response: TournamentResponse): TournamentInfo {
  // `ky` throws on non-2xx, so a successful query only ever yields the 200
  // shape; this guard narrows the generated union and stays defensive.
  if (response.status !== 200) {
    throw new Error(`Unexpected tournament response status: ${response.status}`)
  }

  const dto = response.data
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    leaderboardId: dto.leaderboard_id,
    startDate: dto.start_date,
    endDate: dto.end_date,
    prizePoolCents: dto.prize_pool_cents,
    // `host_stream_live` is optional on the DTO (#149) — default to false so
    // the UI always has a definite boolean and the host card stays dark when
    // the field or a configured host channel is absent.
    hostStreamLive: dto.host_stream_live ?? false,
    // `host_stream_urls` is the server-side liveness-detection list (#149),
    // surfaced for the admin editor (#225). Required on the DTO, but default
    // defensively so a missing field never breaks the form seed.
    hostStreamUrls: dto.host_stream_urls ?? [],
    createdAt: dto.created_at,
  }
}
