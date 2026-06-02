import type { getProgressionV1TournamentsTournamentSlugProgressionGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { PlayerProgression } from "@/api/generated/types"
import type { PlayerSeries, ProgressionSnapshot } from "@/types"

/**
 * Adapter at the network boundary: maps the generated progression DTOs to the
 * UI-facing `ProgressionSnapshot`. Adapter files are the only place generated
 * API types may be imported — drift in the API shape stops here (CLAUDE.md).
 */

type ProgressionResponse =
  getProgressionV1TournamentsTournamentSlugProgressionGetResponse

function toPlayerSeries(dto: PlayerProgression): PlayerSeries {
  return {
    tournamentPlayerId: dto.tournament_player_id,
    profileId: dto.profile_id,
    alias: dto.alias,
    points: dto.points.map((p) => ({
      completedAt: p.completed_at,
      rating: p.rating,
    })),
  }
}

/**
 * Unwraps the orval `{ data, status }` envelope plus the API's
 * `{ last_polled_at, items }` list envelope, then remaps each player's series.
 * Designed to be passed straight to TanStack Query's `select`, so the cache
 * keeps the raw DTOs while components only ever see `ProgressionSnapshot`.
 */
export function toProgressionSnapshot(
  response: ProgressionResponse
): ProgressionSnapshot {
  // `ky` throws on non-2xx, so a successful query only ever yields the 200
  // shape; this guard narrows the generated union and stays defensive.
  if (response.status !== 200) {
    throw new Error(
      `Unexpected progression response status: ${response.status}`
    )
  }

  return {
    lastPolledAt: response.data.last_polled_at,
    series: response.data.items.map(toPlayerSeries),
  }
}
