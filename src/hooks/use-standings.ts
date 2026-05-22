import { useGetStandingsV1TournamentsTournamentSlugStandingsGet } from "@/api/generated/hooks/tournaments/tournaments"
import { toStandingsSnapshot } from "@/api/adapters/standings"
import { activeTournament } from "@/config/tournaments"
import type { StandingsSnapshot } from "@/types"

/**
 * Fetches the current standings for the active tournament.
 *
 * Wraps the orval-generated query hook and runs the adapter through TanStack
 * Query's `select`, so components receive a UI-facing `StandingsSnapshot`
 * while the cache retains the raw API DTOs. The tournament to query comes
 * from the build-selected tournament config — components never pass it in.
 */
export function useStandings() {
  return useGetStandingsV1TournamentsTournamentSlugStandingsGet<StandingsSnapshot>(
    activeTournament.apiTournamentSlug,
    { query: { select: toStandingsSnapshot } }
  )
}
