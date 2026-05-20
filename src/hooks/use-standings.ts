import { useGetStandingsV1LeaderboardsLeaderboardIdStandingsGet } from "@/api/generated/hooks/leaderboards/leaderboards"
import { toStandingsSnapshot } from "@/api/adapters/standings"
import { activeTournament } from "@/config/tournaments"
import type { StandingsSnapshot } from "@/types"

/**
 * Fetches the current standings for the active tournament's leaderboard.
 *
 * Wraps the orval-generated query hook and runs the adapter through TanStack
 * Query's `select`, so components receive a UI-facing `StandingsSnapshot`
 * while the cache retains the raw API DTOs. The leaderboard to query comes
 * from the build-selected tournament config — components never pass it in.
 */
export function useStandings() {
  return useGetStandingsV1LeaderboardsLeaderboardIdStandingsGet<StandingsSnapshot>(
    activeTournament.leaderboardId,
    { query: { select: toStandingsSnapshot } }
  )
}
