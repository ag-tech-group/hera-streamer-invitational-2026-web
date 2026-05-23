import { toTournamentInfo } from "@/api/adapters/tournament"
import { useGetTournamentDetailV1TournamentsTournamentSlugGet } from "@/api/generated/hooks/tournaments/tournaments"
import { activeTournament } from "@/config/tournaments"
import type { TournamentInfo } from "@/types"

/**
 * Fetches the active tournament's record from the API.
 *
 * Wraps the orval-generated query hook and runs the adapter through TanStack
 * Query's `select`, so components receive a UI-facing `TournamentInfo` while
 * the cache retains the raw DTO. The tournament slug comes from the
 * build-selected config — callers never pass it in.
 *
 * The tournament record changes rarely (name and dates are essentially
 * static), so no SSE invalidation is wired — the default query `staleTime`
 * is fine.
 */
export function useTournament() {
  return useGetTournamentDetailV1TournamentsTournamentSlugGet<TournamentInfo>(
    activeTournament.apiTournamentSlug,
    { query: { select: toTournamentInfo } }
  )
}
