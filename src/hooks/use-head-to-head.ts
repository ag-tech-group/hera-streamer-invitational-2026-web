import { useGetHeadToHeadV1TournamentsTournamentSlugHeadToHeadGet } from "@/api/generated/hooks/tournaments/tournaments"
import { toHeadToHeadSnapshot } from "@/api/adapters/head-to-head"
import { activeTournament } from "@/config/tournaments"
import type { HeadToHeadSnapshot } from "@/types"

/** How many head-to-head games to fetch, newest first (the API allows 1–200). */
const HEAD_TO_HEAD_LIMIT = 50

/**
 * Fetches the streamer-vs-streamer head-to-head feed for the active tournament
 * (#349).
 *
 * Mirrors `useMatches`: wraps the orval-generated query hook and runs the
 * adapter through TanStack Query's `select`, so components receive a UI-facing
 * `HeadToHeadSnapshot` while the cache retains the raw DTOs. The endpoint
 * already returns only games between two of the tournament's own entrants, so
 * there's no client-side filtering. The tournament slug comes from the
 * build-selected config — components never pass it in. Invalidated on the
 * `matches` SSE nudge (see `useLiveUpdates`).
 */
export function useHeadToHead() {
  return useGetHeadToHeadV1TournamentsTournamentSlugHeadToHeadGet<HeadToHeadSnapshot>(
    activeTournament.apiTournamentSlug,
    { limit: HEAD_TO_HEAD_LIMIT },
    { query: { select: toHeadToHeadSnapshot } }
  )
}
