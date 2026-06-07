import type { MatchOutcome } from "./matches"

/**
 * One entrant's side of a head-to-head game, ready for display (#349).
 *
 * UI-facing counterpart of the generated `HeadToHeadPlayer` DTO — camelCased and
 * decoupled so API shape drift is absorbed by the adapter
 * (`src/api/adapters/head-to-head.ts`) and never reaches components. The card
 * renders entrants in array order, which the API sorts winner-first.
 */
export interface HeadToHeadEntrant {
  /** Stable roster identity (#281), shared with the player's standings row. */
  tournamentPlayerId: number
  /** Linked relic profile id. */
  profileId: number
  /** Resolved display label (same source/meaning as `StandingsRow.name`). */
  name: string
  /** Relic civilization id (kept for keys/debugging; display uses the name). */
  civId: number
  /** Civ name, or null when the id isn't in the civilizations reference yet. */
  civName: string | null
  /**
   * Public URL of the civ's heraldic emblem, or null — the civ is newer than our
   * committed shield set, or its name didn't resolve. Resolved at the adapter via
   * the same `civEmblemUrl` the standings/civ board use (keyed on the civ name).
   */
  civEmblemUrl: string | null
  /**
   * The entrant's rating going into the game — the "elo at the time" the card
   * shows (#349). Null on an unranked game or before the upstream settled it.
   */
  oldRating: number | null
  /** Rating after the game, or null (same cases as `oldRating`). */
  newRating: number | null
  /** Win or loss; null only if the upstream hasn't settled the result yet. */
  outcome: MatchOutcome | null
}

/**
 * One completed streamer-vs-streamer game, ready for display (#349).
 *
 * UI-facing counterpart of the generated `HeadToHeadMatch` DTO. The endpoint
 * only ever returns games between two of the tournament's own entrants, so the
 * card renders every game it's handed with no client-side filtering.
 */
export interface HeadToHeadGame {
  /** Upstream relic match id — also the key for the external match link. */
  matchId: number
  /** Map the game was played on, with the replay extension stripped. */
  mapName: string
  /** ISO-8601 start time — the date the card shows for the game. */
  startedAt: string
  /** ISO-8601 completion time, or null if the upstream hasn't recorded it. */
  completedAt: string | null
  /** Wall-clock length in seconds, or null when the API has none. */
  durationSeconds: number | null
  /**
   * External link to the game on aoe2insights, built at the adapter from the
   * relic match id (`https://www.aoe2insights.com/match/{matchId}/`) so the
   * component just renders the anchor.
   */
  matchUrl: string
  /** Both entrants, winner first (the API's order, preserved). */
  entrants: HeadToHeadEntrant[]
}

/**
 * A head-to-head feed snapshot: the games (newest first) plus the upstream poll
 * time the data reflects. Empty `games` is the normal early-tournament state.
 */
export interface HeadToHeadSnapshot {
  /** ISO-8601 time the upstream data was last polled, or `null` if never. */
  lastPolledAt: string | null
  games: HeadToHeadGame[]
}
