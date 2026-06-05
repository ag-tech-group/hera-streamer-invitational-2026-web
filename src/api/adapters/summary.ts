import type { getSummaryV1TournamentsTournamentSlugSummaryGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { StreakSummaryCard, SummaryCard } from "@/api/generated/types"
import type { StreakLeader, SummaryLeader, TournamentSummary } from "@/types"

/**
 * Adapter at the network boundary: maps the generated `/summary` DTOs to the
 * UI-facing `TournamentSummary`. Adapter files are the only place generated API
 * types may be imported — API shape drift stops here (CLAUDE.md).
 */

type SummaryResponse = getSummaryV1TournamentsTournamentSlugSummaryGetResponse

function toLeader(card: SummaryCard | null): SummaryLeader | null {
  if (!card) return null
  return {
    tournamentPlayerId: card.tournament_player_id,
    profileId: card.profile_id,
    name: card.name,
    value: card.value,
  }
}

function toStreakLeader(card: StreakSummaryCard | null): StreakLeader | null {
  if (!card) return null
  return {
    tournamentPlayerId: card.tournament_player_id,
    profileId: card.profile_id,
    name: card.name,
    value: card.value,
    // Optional on the DTO (a win that settled without a completion time) —
    // coerce `undefined` to `null` so the UI type stays a clean `string | null`.
    streakStart: card.streak_start ?? null,
    streakEnd: card.streak_end ?? null,
  }
}

/**
 * Unwraps the orval `{ data, status }` envelope and remaps the cards. Designed
 * to be passed straight to TanStack Query's `select`.
 */
export function toTournamentSummary(
  response: SummaryResponse
): TournamentSummary {
  if (response.status !== 200) {
    throw new Error(`Unexpected summary response status: ${response.status}`)
  }
  const data = response.data
  return {
    lastPolledAt: data.last_polled_at,
    highestPeakRating: toLeader(data.highest_peak_rating),
    bestWinRate: toLeader(data.best_win_rate),
    longestWinStreak: toStreakLeader(data.longest_win_streak),
    biggestClimber: toLeader(data.biggest_climber),
    mostGamesPlayed: toLeader(data.most_games_played),
  }
}
