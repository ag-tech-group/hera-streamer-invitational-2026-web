import { useListMatchesV1TournamentsTournamentSlugMatchesGet } from "@/api/generated/hooks/matches/matches"
import { toMatchesSnapshot } from "@/api/adapters/matches"
import { activeTournament } from "@/config/tournaments"
import type { MatchesSnapshot } from "@/types"

/** Upstream cap on the matches list (the API allows 1–200). */
const MATCH_LIMIT = 200

/**
 * Fetches the recent matches for the active tournament.
 *
 * Mirrors `useStandings`: wraps the orval-generated query hook and runs the
 * adapter through TanStack Query's `select`, so components receive a UI-facing
 * `MatchesSnapshot` while the cache retains the raw DTOs. Requests the upstream
 * maximum so the civ pick/win stats (#302) get the widest sample the endpoint
 * serves; the tournament slug comes from the build-selected config — components
 * never pass it in.
 */
export function useMatches() {
  return useListMatchesV1TournamentsTournamentSlugMatchesGet<MatchesSnapshot>(
    activeTournament.apiTournamentSlug,
    { limit: MATCH_LIMIT },
    { query: { select: toMatchesSnapshot } }
  )
}
