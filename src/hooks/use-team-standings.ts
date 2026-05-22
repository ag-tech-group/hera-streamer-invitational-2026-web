import { useGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGet } from "@/api/generated/hooks/tournaments/tournaments"
import { toTeamStandingsSnapshot } from "@/api/adapters/team-standings"
import { activeTournament } from "@/config/tournaments"
import type { TeamStandingsSnapshot } from "@/types"

/**
 * Fetches the team standings for the active tournament.
 *
 * Mirrors `useStandings`: wraps the orval-generated query hook and runs the
 * adapter through TanStack Query's `select`, so components receive a UI-facing
 * `TeamStandingsSnapshot`. `enabled` lets the home page defer the request
 * until the Teams view is opened — the players standings are the default.
 */
export function useTeamStandings(enabled: boolean) {
  return useGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGet<TeamStandingsSnapshot>(
    activeTournament.apiTournamentSlug,
    { query: { enabled, select: toTeamStandingsSnapshot } }
  )
}
