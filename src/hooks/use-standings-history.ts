import { useGetStandingsHistoryV1TournamentsTournamentSlugStandingsHistoryGet } from "@/api/generated/hooks/tournaments/tournaments"
import { toStandingsHistorySnapshot } from "@/api/adapters/standings-history"
import { activeTournament } from "@/config/tournaments"
import type { StandingsHistorySnapshot } from "@/types"

/**
 * Fetches the per-day standings history for the active tournament.
 *
 * Mirrors `useStandings`: wraps the orval-generated query hook and runs the
 * adapter through TanStack Query's `select`, so components receive a UI-facing
 * `StandingsHistorySnapshot`. The API reconstructs position-by-peak per bucket
 * server-side — the frontend just plots it.
 */
export function useStandingsHistory() {
  return useGetStandingsHistoryV1TournamentsTournamentSlugStandingsHistoryGet<StandingsHistorySnapshot>(
    activeTournament.apiTournamentSlug,
    { query: { select: toStandingsHistorySnapshot } }
  )
}
