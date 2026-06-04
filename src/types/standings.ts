/** Outcome of a single completed match, used for a player's recent form. */
export type MatchResult = "win" | "loss"

/**
 * Per-player presentation overrides (#152). The API treats `presentation`
 * as an opaque bag and never interprets its keys; the frontend shapes it
 * at the adapter boundary into the keys it knows about, dropping anything
 * unrecognised. All keys are optional — the standings UI falls back to
 * the raw `alias` / `country` fields when an override isn't set.
 */
export interface PlayerPresentation {
  /** Display name shown in place of the raw ladder alias when set. */
  displayName?: string
  /**
   * Flag glyph (typically a country emoji) shown in place of the ISO-code
   * flag SVG when set. Frontend doesn't interpret the value — whatever the
   * bag carries is rendered as-is so the host can switch between, say, a
   * national flag and a rainbow flag without a frontend change.
   */
  flag?: string
  /** Channel URLs the player streams from, in display order. */
  streamUrls?: string[]
  /**
   * Host-authored background blurb, revealed in a hover/tap affordance next
   * to the player's name — broadcast flavour (e.g. "2× champion, plays
   * aggressive Scouts"). Plain text; newlines are preserved on render.
   */
  bio?: string
  /**
   * Host-curated link target for the player's name — typically their
   * aoe2insights `/user/<id>` profile. The relic `profile_id` the poller uses
   * doesn't match aoe2insights' internal URL id (#131), so the host supplies
   * the exact URL here rather than the frontend deriving it; when absent the
   * name renders as plain text (no link).
   */
  profileUrl?: string
}

/**
 * The team a player belongs to, folded onto their standings row — a compact
 * reference (id + display strings, no aggregates). Null when the player isn't
 * on a team. The richer per-team aggregates live on `TeamStandingsRow`.
 */
export interface StandingsTeam {
  teamId: number
  /** Display name of the team, shown on hover over the initials chip. */
  name: string
  /** Short team initials, shown as a chip in the standings Team column. */
  initials: string
}

/**
 * One player's row in the standings, ready for display.
 *
 * UI-facing counterpart of the generated `StandingRow` DTO: camelCased and
 * decoupled so that API shape drift is absorbed by the adapter
 * (`src/api/adapters/standings.ts`) and never reaches components.
 */
export interface StandingsRow {
  /** Stable roster identity (#184) — non-null even for an unlinked entrant. */
  tournamentPlayerId: number
  /**
   * AoE2 profile id, or `null` for an **unlinked entrant** — an announced
   * roster member whose `profile_id` hasn't minted yet. An unlinked entrant
   * still appears on the standings (sorted to the tail) and carries an `alias`
   * + `presentation` for display, but has no rating data yet: the profile link
   * is an optional enrichment, not the row's identity (that's
   * `tournamentPlayerId`, #281). The player-name link is driven by
   * `presentation.profileUrl` (#131), not this id.
   */
  profileId: number | null
  /**
   * The unified display label (#187) — always present, for linked and unlinked
   * entrants alike. This is the canonical name to render: surfaces resolve to
   * `presentation.displayName ?? name`. The old `alias` fallback is gone — see
   * `alias`.
   */
  name: string
  /**
   * Raw ladder handle (enrichment, not identity). For a linked entrant it's the
   * polled aoe2 alias; for an unlinked one the API falls it back to `name`. Kept
   * for where the genuine ladder handle is wanted (analytics, mis-link checks),
   * not for the display label — use `presentation.displayName ?? name`.
   */
  alias: string
  /** ISO 3166-1 alpha-2 country code (lowercase), or null if unknown. */
  country: string | null
  /** The player's team, or null if they aren't on one. */
  team: StandingsTeam | null
  /**
   * Player's current rating on the tournament leaderboard. `null` for
   * roster members who haven't played a ranked match yet — the API
   * surfaces them via a left join against `PlayerRating`, sorted to the
   * tail of the standings.
   */
  currentRating: number | null
  /**
   * Lifetime peak rating on the tournament's leaderboard (#246 →
   * `StandingRow.max_rating`). Renders pre-tournament too — it's the player's
   * all-time peak and doesn't change when the event starts (this column was
   * walked back from the in-window peak #238 briefly used). `null` only for
   * brand-new accounts / unlinked entrants, which read `—`.
   */
  maxRating: number | null
  wins: number
  losses: number
  /**
   * Current win/loss streak **within the tournament window** (#238 →
   * `tournament_record.streak`): positive a win streak, negative a loss
   * streak, 0 when no in-window games.
   */
  streak: number
  /**
   * Longest run of consecutive wins **within the tournament window** (#331 →
   * `tournament_record.longest_win_streak`): a non-negative count, `0` when the
   * player has no in-window wins. Distinct from `streak`, which is the *current*
   * signed run (latest only) — e.g. `W W W L W` gives `streak = 1` but
   * `longestWinStreak = 3`.
   */
  longestWinStreak: number
  /**
   * Outcomes of the player's most recent **in-window** completed matches,
   * most-recent first (#238 → `tournament_record.recent_results`). Empty when
   * they have no completed tournament match.
   */
  recentResults: MatchResult[]
  /**
   * Win percentage (0–100, 1dp) over in-window games (#238 →
   * `tournament_record.win_pct`), or `null` when they have no decided games.
   */
  winPct: number | null
  /** Matches the player has completed within the tournament's date window. */
  gamesPlayed: number
  /** Position on the leaderboard, or null if unranked. */
  rank: number | null
  /** Total tracked players on the leaderboard, or null if unknown. */
  rankTotal: number | null
  /** Whether the player is in a live match right now. */
  inMatch: boolean
  /**
   * ISO-8601 timestamp of the player's most recent **in-window** match (#238
   * → `tournament_record.last_match_at`), or `null` when none. Backs the
   * Activity "Last match 1h" badge (green within 24h, grey when older).
   */
  lastMatchAt: string | null
  /**
   * ISO-8601 timestamp of when this row was last refreshed upstream, or
   * `null` for an unlinked entrant — no upstream profile to poll yet, so no
   * refresh signal.
   */
  updatedAt: string | null
  /**
   * Frontend-defined overrides for how the row renders (display name, flag,
   * stream URLs). Shape comes from the adapter — see `PlayerPresentation`.
   * Empty when the API has no presentation set for the player.
   */
  presentation: PlayerPresentation
  /**
   * Whether one of the player's `presentation.streamUrls` is currently
   * broadcasting live (#112). Used by the Watch column to highlight an
   * actionable "watch them right now" affordance.
   */
  streamLive: boolean
  /**
   * Title of the player's current live broadcast (#328) — Twitch's, or
   * YouTube's as a fallback. `null` when offline or when the platform omits it.
   * Surfaced as the Watch-icon hover tooltip, never inline (titles are long,
   * emoji-laden free text).
   */
  streamTitle: string | null
  /**
   * Game category of the current live broadcast (#328), e.g. `"Age of Empires
   * II"`. **Twitch-only** — YouTube has no per-stream category, so a
   * YouTube-sourced live row is always `null` here (its `streamTitle` still
   * populates), as is any offline row or one Twitch omits. Drives the Watch
   * dot's trust treatment: a *confirmed* non-AoE2 category mutes the dot, while
   * AoE2 — or `null`, which we decline to punish — keeps it brand-blue.
   */
  streamCategory: string | null
}

/**
 * A complete standings snapshot for one leaderboard: the ranked rows plus the
 * upstream poll time the data reflects.
 */
export interface StandingsSnapshot {
  /** ISO-8601 time the upstream data was last polled, or null if never. */
  lastPolledAt: string | null
  rows: StandingsRow[]
}
