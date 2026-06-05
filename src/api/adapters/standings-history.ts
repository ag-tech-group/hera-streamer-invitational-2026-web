import type { getStandingsHistoryV1TournamentsTournamentSlugStandingsHistoryGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type {
  PlayerStandingHistory,
  StandingHistoryPoint,
  TeamStandingHistory,
  TeamStandingHistoryPoint,
} from "@/api/generated/types"
import type {
  PlayerHistory,
  PositionPoint,
  StandingsHistorySnapshot,
  TeamHistory,
  TeamPositionPoint,
} from "@/types"

/**
 * Adapter at the network boundary: maps generated `/standings/history` DTOs to
 * the UI-facing `StandingsHistorySnapshot`. Adapter files are the only place
 * generated API types may be imported — API shape drift stops here (CLAUDE.md).
 */

type StandingsHistoryResponse =
  getStandingsHistoryV1TournamentsTournamentSlugStandingsHistoryGetResponse

function toPositionPoint(p: StandingHistoryPoint): PositionPoint {
  return { position: p.position, peakRating: p.peak_rating }
}

function toPlayerHistory(dto: PlayerStandingHistory): PlayerHistory {
  return {
    tournamentPlayerId: dto.tournament_player_id,
    profileId: dto.profile_id,
    name: dto.name,
    points: dto.points.map(toPositionPoint),
  }
}

function toTeamPositionPoint(p: TeamStandingHistoryPoint): TeamPositionPoint {
  return { position: p.position, combinedPeakElo: p.combined_peak_elo }
}

function toTeamHistory(dto: TeamStandingHistory): TeamHistory {
  return {
    teamId: dto.team_id,
    name: dto.name,
    points: dto.points.map(toTeamPositionPoint),
  }
}

/**
 * Unwraps the orval `{ data, status }` envelope and remaps the history series.
 * Designed to be passed straight to TanStack Query's `select`.
 */
export function toStandingsHistorySnapshot(
  response: StandingsHistoryResponse
): StandingsHistorySnapshot {
  if (response.status !== 200) {
    throw new Error(
      `Unexpected standings-history response status: ${response.status}`
    )
  }
  return {
    lastPolledAt: response.data.last_polled_at,
    buckets: response.data.buckets,
    players: response.data.players.map(toPlayerHistory),
    teams: response.data.teams.map(toTeamHistory),
  }
}
