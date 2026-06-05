/**
 * Headline "leader" stat cards for the active tournament, served by the API's
 * `/summary` endpoint (#243). One card per metric, naming the leading roster
 * entrant and their value — leader selection, tie-breaking, and the win-rate
 * minimum-games guard all live server-side, so the stats page reads the five
 * cards directly instead of scanning the standings.
 *
 * UI-facing counterparts of the generated `TournamentSummary` DTOs, camelCased
 * and decoupled at the adapter boundary (`src/api/adapters/summary.ts`).
 */

/** One card's leader: the entrant who tops a metric, plus the value. */
export interface SummaryLeader {
  tournamentPlayerId: number
  profileId: number
  /** Display label, resolved server-side (host `displayName` override applied). */
  name: string
  /**
   * The leading value: a rating/count for most cards, a 0–100 percentage for
   * win rate, or a **signed** net rating delta for the climber (can be negative
   * when the field declined — the leader then "dropped the least").
   */
  value: number
}

/** The longest-win-streak leader, plus the peak run's date range (#243). */
export interface StreakLeader extends SummaryLeader {
  /** `completed_at` of the first win in the peak run; null if untimed. */
  streakStart: string | null
  /** `completed_at` of the last win in the peak run; null if untimed. */
  streakEnd: string | null
}

/** The five headline cards, mirroring the stats page's row. Each `null` when no entrant qualifies. */
export interface TournamentSummary {
  lastPolledAt: string | null
  highestPeakRating: SummaryLeader | null
  bestWinRate: SummaryLeader | null
  longestWinStreak: StreakLeader | null
  biggestClimber: SummaryLeader | null
  mostGamesPlayed: SummaryLeader | null
}
