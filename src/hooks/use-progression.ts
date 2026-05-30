import { useGetProgressionV1TournamentsTournamentSlugProgressionGet } from "@/api/generated/hooks/tournaments/tournaments"
import { toProgressionSnapshot } from "@/api/adapters/progression"
import { activeTournament } from "@/config/tournaments"
import type { ProgressionSnapshot } from "@/types"

/**
 * Fetches per-player rating progression for the active tournament.
 *
 * Wraps the orval-generated query hook and runs the adapter through TanStack
 * Query's `select`, so components receive a UI-facing `ProgressionSnapshot`
 * while the cache retains the raw DTOs. Only ever mounts on the (lazy) `/stats`
 * route, so there's no active-view gating like `useTeamStandings` needs — the
 * fetch simply starts when the stats page does.
 */
export function useProgression() {
  return useGetProgressionV1TournamentsTournamentSlugProgressionGet<ProgressionSnapshot>(
    activeTournament.apiTournamentSlug,
    { query: { select: toProgressionSnapshot } }
  )
}
