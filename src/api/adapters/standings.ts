import type { getStandingsV1TournamentsTournamentSlugStandingsGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type {
  RecentMatchup as RecentMatchupDto,
  StandingRow,
  StandingRowPresentation,
} from "@/api/generated/types"
import { civEmblemUrl } from "@/lib/civilizations"
import { cleanMapName } from "@/lib/format"
import { isHttpUrl } from "@/lib/url"
import type {
  PlayerPresentation,
  RecentMatchup,
  StandingsRow,
  StandingsSnapshot,
} from "@/types"

/**
 * Adapter at the network boundary: maps generated standings DTOs to the
 * UI-facing `StandingsSnapshot`. Adapter files are the only place generated
 * API types may be imported — drift in the API shape stops here (CLAUDE.md).
 */

/** Full response shape returned by the generated standings query hook. */
type StandingsResponse =
  getStandingsV1TournamentsTournamentSlugStandingsGetResponse

function toStandingsRow(
  dto: StandingRow,
  /** tournament_player_id → host profile URL, for fellow-streamer matchup links (#349). */
  profileUrlByPlayerId: ReadonlyMap<number, string>
): StandingsRow {
  return {
    tournamentPlayerId: dto.tournament_player_id,
    profileId: dto.profile_id,
    // The generated DTO marks `name` required, but a stale API revision served
    // mid-rollover can omit it (#313) — coerce to a string so the
    // `StandingsRow.name: string` contract every consumer relies on (the sort
    // comparator, PlayerCell, getSortValue) actually holds. Falls back to the
    // ladder handle, then empty, so a malformed row degrades to a label rather
    // than crashing the whole standings render.
    name: dto.name ?? dto.alias ?? "",
    alias: dto.alias,
    country: dto.country,
    team: dto.team
      ? {
          teamId: dto.team.team_id,
          name: dto.team.name,
          initials: dto.team.initials,
        }
      : null,
    // Rating stays the live lifetime ladder rating (organizer decision, #238)
    // — it should move as the player competes and we don't recompute it.
    currentRating: dto.current_rating,
    // Peak reads the LIFETIME ladder peak (`max_rating`), not the in-window
    // max (#246 walks this one column back from #238): the host wants Peak to
    // show pre-tournament too, so it's the player's all-time peak on the
    // tournament's leaderboard and doesn't change when the event starts. Null
    // only for brand-new accounts / unlinked entrants → renders `—`.
    maxRating: dto.max_rating,
    // The remaining stats stay tournament-window scoped (#238): streak, recent
    // form, win%, and activity, so a streamer with no tournament matches yet
    // reads `—` instead of a misleading lifetime figure. `win_pct` is
    // API-computed (0–100, 1dp).
    wins: dto.tournament_record.wins,
    losses: dto.tournament_record.losses,
    streak: dto.tournament_record.streak,
    longestWinStreak: dto.tournament_record.longest_win_streak,
    recentMatchups: dto.tournament_record.recent_matchups.map((m) =>
      toRecentMatchup(m, profileUrlByPlayerId)
    ),
    winPct: dto.tournament_record.win_pct,
    gamesPlayed: dto.tournament_record.games_played,
    rank: dto.rank,
    rankTotal: dto.rank_total,
    inMatch: dto.in_match,
    lastMatchAt: dto.tournament_record.last_match_at,
    updatedAt: dto.updated_at,
    presentation: toPlayerPresentation(dto.presentation),
    streamLive: dto.stream_live,
    // Live-stream enrichments (#328): title for the Watch-icon tooltip, category
    // for the dot's "actually on AoE2?" treatment. Both null when offline; the
    // category is also null for YouTube (no per-stream category) or when Twitch
    // omits it. Passed straight through — the trust logic lives in the component.
    streamTitle: dto.stream_title,
    streamCategory: dto.stream_category,
  }
}

/**
 * Resolves a generated `RecentMatchup` DTO to its UI form (#339): each civ's
 * name → a heraldic emblem via the same `civEmblemUrl` the civ board uses (keyed
 * on the API's civ *name*, the id space being unstable — see `civilizations.ts`),
 * and the raw replay map name → a clean label. Either civ name can be null — a
 * civ newer than our emblem snapshot, or an opponent the API couldn't name (or a
 * non-1v1 board with none) — in which case its emblem is null too and the
 * tooltip falls back to a placeholder.
 *
 * #349 folds in the opponent player: their `opponentName` (always shown), a
 * `opponentIsStreamer` flag (a non-null `opponent_tournament_player_id` ⇒ a
 * fellow streamer → highlight), and the streamer's `opponentProfileUrl` resolved
 * from the snapshot's own rows via `profileUrlByPlayerId` (null ⇒ highlight
 * without a link).
 */
function toRecentMatchup(
  m: RecentMatchupDto,
  profileUrlByPlayerId: ReadonlyMap<number, string>
): RecentMatchup {
  // A non-null opponent_tournament_player_id means the opponent is one of the
  // tournament's own roster streamers; a null id is a regular ladder opponent.
  const opponentPlayerId = m.opponent_tournament_player_id
  return {
    outcome: m.outcome,
    civName: m.civilization_name,
    civEmblemUrl: m.civilization_name
      ? civEmblemUrl(m.civilization_name)
      : null,
    opponentCivName: m.opponent_civilization_name,
    opponentCivEmblemUrl: m.opponent_civilization_name
      ? civEmblemUrl(m.opponent_civilization_name)
      : null,
    opponentName: m.opponent_name,
    opponentIsStreamer: opponentPlayerId !== null,
    // Link a fellow streamer to their host-curated profile when their row
    // carries one; null (not a streamer, or a streamer without a profile URL)
    // leaves the highlighted name as plain text — we never synthesise a link.
    opponentProfileUrl:
      opponentPlayerId !== null
        ? (profileUrlByPlayerId.get(opponentPlayerId) ?? null)
        : null,
    mapName: cleanMapName(m.map_name),
    completedAt: m.completed_at,
  }
}

/**
 * The API treats `presentation` as an opaque record (`Record<string,
 * unknown>` in the generated type), so the adapter is the one place that
 * narrows the bag down to the keys the frontend knows about. Anything else
 * the bag carries is dropped — by design, since the API has no schema on it
 * and we don't want unrecognised keys leaking into UI components.
 */
function toPlayerPresentation(
  raw: StandingRowPresentation
): PlayerPresentation {
  if (!raw || typeof raw !== "object") return {}
  const bag = raw as Record<string, unknown>
  const out: PlayerPresentation = {}
  if (typeof bag.displayName === "string") out.displayName = bag.displayName
  if (typeof bag.flag === "string") out.flag = bag.flag
  if (Array.isArray(bag.streamUrls)) {
    // Scheme-filter, not just type-filter: these render straight into anchor
    // hrefs, so a non-http(s) value (e.g. `javascript:`) would be an XSS sink.
    out.streamUrls = bag.streamUrls.filter(
      (u): u is string => typeof u === "string" && isHttpUrl(u)
    )
  }
  if (typeof bag.bio === "string") out.bio = bag.bio
  // Drop a non-http(s) profileUrl here so the name link can never become a
  // `javascript:` href — the API stores the bag opaquely and never validates.
  if (typeof bag.profileUrl === "string" && isHttpUrl(bag.profileUrl)) {
    out.profileUrl = bag.profileUrl
  }
  return out
}

/**
 * Unwraps the orval `{ data, status, headers }` envelope plus the API's
 * `{ last_polled_at, items }` list envelope, then remaps each row.
 *
 * Designed to be passed straight to TanStack Query's `select`, so the query
 * cache keeps the raw DTOs (which SSE updates will write later) while
 * components only ever see `StandingsSnapshot`.
 */
export function toStandingsSnapshot(
  response: StandingsResponse
): StandingsSnapshot {
  // `ky` throws on non-2xx, so a successful query only ever yields the 200
  // shape; this guard narrows the generated union and stays defensive.
  if (response.status !== 200) {
    throw new Error(`Unexpected standings response status: ${response.status}`)
  }

  const items = response.data.items
  // A directory of every entrant's host profile URL, keyed by the stable
  // tournament_player_id (#349). Built once for the whole snapshot so a recent
  // matchup against a fellow streamer can link to that streamer's profile —
  // the URL lives on their own row's presentation bag, not on the matchup.
  const profileUrlByPlayerId = new Map<number, string>()
  for (const item of items) {
    const url = toPlayerPresentation(item.presentation).profileUrl
    if (url) profileUrlByPlayerId.set(item.tournament_player_id, url)
  }

  return {
    lastPolledAt: response.data.last_polled_at,
    rows: items.map((item) => toStandingsRow(item, profileUrlByPlayerId)),
  }
}
