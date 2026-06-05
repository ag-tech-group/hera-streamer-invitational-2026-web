import { useGetSummaryV1TournamentsTournamentSlugSummaryGet } from "@/api/generated/hooks/tournaments/tournaments"
import { toTournamentSummary } from "@/api/adapters/summary"
import { activeTournament } from "@/config/tournaments"
import type { TournamentSummary } from "@/types"

/**
 * Fetches the headline stat-card leaders for the active tournament (#243).
 *
 * Mirrors `useStandings`: wraps the orval-generated query hook and runs the
 * adapter through TanStack Query's `select`, so components receive a UI-facing
 * `TournamentSummary`. The API selects each card's leader, tie-breaks, and
 * applies the win-rate minimum-games guard server-side — the frontend just
 * renders. `win_rate_min_games` is left unset, so the API's default guard
 * applies. Invalidated on the `standings` SSE nudge (see `useLiveUpdates`).
 */
export function useSummary() {
  return useGetSummaryV1TournamentsTournamentSlugSummaryGet<TournamentSummary>(
    activeTournament.apiTournamentSlug,
    undefined,
    { query: { select: toTournamentSummary } }
  )
}
