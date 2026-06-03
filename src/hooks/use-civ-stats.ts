import { useGetCivStatsV1TournamentsTournamentSlugCivStatsGet } from "@/api/generated/hooks/tournaments/tournaments"
import { toCivStatsSnapshot } from "@/api/adapters/civ-stats"
import { activeTournament } from "@/config/tournaments"
import type { CivStatsSnapshot } from "@/types"

/**
 * Fetches the civilization pick/win aggregate for the active tournament.
 *
 * Mirrors `useStandings`: wraps the orval-generated query hook and runs the
 * adapter through TanStack Query's `select`, so components receive a UI-facing
 * `CivStatsSnapshot`. The API aggregates entrants' picks/wins server-side over
 * the whole tournament — the frontend just renders, no `/matches` math.
 */
export function useCivStats() {
  return useGetCivStatsV1TournamentsTournamentSlugCivStatsGet<CivStatsSnapshot>(
    activeTournament.apiTournamentSlug,
    { query: { select: toCivStatsSnapshot } }
  )
}
