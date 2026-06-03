import type { getCivStatsV1TournamentsTournamentSlugCivStatsGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { CivStat, PlayerCivStats } from "@/api/generated/types"
import type { CivCount, CivStatsSnapshot, PlayerCivCounts } from "@/types"

/**
 * Adapter at the network boundary: maps generated `/civ-stats` DTOs to the
 * UI-facing `CivStatsSnapshot`. Adapter files are the only place generated API
 * types may be imported — API shape drift stops here (CLAUDE.md).
 */

type CivStatsResponse =
  getCivStatsV1TournamentsTournamentSlugCivStatsGetResponse

function toCivCount(dto: CivStat): CivCount {
  return { civId: dto.civilization_id, picks: dto.picks, wins: dto.wins }
}

function toPlayerCivCounts(dto: PlayerCivStats): PlayerCivCounts {
  return {
    tournamentPlayerId: dto.tournament_player_id,
    profileId: dto.profile_id,
    civs: dto.civs.map(toCivCount),
  }
}

/**
 * Unwraps the orval `{ data, status }` envelope and remaps the civ-stats
 * aggregate. Designed to be passed straight to TanStack Query's `select`, so
 * the cache keeps the raw DTOs while components only ever see a
 * `CivStatsSnapshot`.
 */
export function toCivStatsSnapshot(
  response: CivStatsResponse
): CivStatsSnapshot {
  // The fetch client throws on non-2xx, so a successful query only ever yields
  // the 200 shape; this guard narrows the generated union and stays defensive.
  if (response.status !== 200) {
    throw new Error(`Unexpected civ-stats response status: ${response.status}`)
  }

  return {
    lastPolledAt: response.data.last_polled_at,
    overall: response.data.overall.map(toCivCount),
    byPlayer: response.data.by_player.map(toPlayerCivCounts),
  }
}
