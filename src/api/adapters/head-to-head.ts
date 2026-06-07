import type { getHeadToHeadV1TournamentsTournamentSlugHeadToHeadGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { HeadToHeadMatch, HeadToHeadPlayer } from "@/api/generated/types"
import { civEmblemUrl } from "@/lib/civilizations"
import { cleanMapName } from "@/lib/format"
import type {
  HeadToHeadEntrant,
  HeadToHeadGame,
  HeadToHeadSnapshot,
} from "@/types"

/**
 * Adapter at the network boundary: maps the generated `/head-to-head` DTOs to
 * the UI-facing `HeadToHeadSnapshot` (#349). Adapter files are the only place
 * generated API types may be imported — API shape drift stops here (CLAUDE.md).
 */

/** Full response shape returned by the generated head-to-head query hook. */
type HeadToHeadResponse =
  getHeadToHeadV1TournamentsTournamentSlugHeadToHeadGetResponse

function toEntrant(dto: HeadToHeadPlayer): HeadToHeadEntrant {
  return {
    tournamentPlayerId: dto.tournament_player_id,
    profileId: dto.profile_id,
    name: dto.name,
    civId: dto.civilization_id,
    civName: dto.civilization_name,
    // Resolve the emblem by civ *name* through the same helper the standings
    // and civ board use; null civ name (or a civ newer than our shield set)
    // yields a null URL and the card shows the name alone.
    civEmblemUrl: dto.civilization_name
      ? civEmblemUrl(dto.civilization_name)
      : null,
    // "Elo at the time" = the pre-game rating (#349); null on an unranked game.
    oldRating: dto.old_rating,
    newRating: dto.new_rating,
    outcome: dto.outcome,
  }
}

function toGame(dto: HeadToHeadMatch): HeadToHeadGame {
  return {
    matchId: dto.match_id,
    mapName: cleanMapName(dto.map_name),
    startedAt: dto.started_at,
    completedAt: dto.completed_at,
    durationSeconds: dto.duration_seconds,
    // The external link is derived deterministically from the relic match id, so
    // the adapter builds it once and the component just renders the anchor.
    matchUrl: `https://www.aoe2insights.com/match/${dto.match_id}/`,
    // Preserve the API's winner-first entrant order.
    entrants: dto.entrants.map(toEntrant),
  }
}

/**
 * Unwraps the orval `{ data, status }` envelope plus the API's
 * `{ last_polled_at, items }` list envelope, then remaps each game.
 *
 * Designed to be passed straight to TanStack Query's `select`, so the query
 * cache keeps the raw DTOs while components only ever see `HeadToHeadSnapshot`.
 */
export function toHeadToHeadSnapshot(
  response: HeadToHeadResponse
): HeadToHeadSnapshot {
  // The fetch client throws on non-2xx, so a successful query only ever yields
  // the 200 shape; this guard narrows the generated union and stays defensive.
  if (response.status !== 200) {
    throw new Error(
      `Unexpected head-to-head response status: ${response.status}`
    )
  }

  return {
    lastPolledAt: response.data.last_polled_at,
    games: response.data.items.map(toGame),
  }
}
