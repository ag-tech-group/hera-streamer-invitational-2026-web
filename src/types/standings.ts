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
  /**
   * AoE2 profile id, or `null` for **placeholder rows** — announced-but-
   * unjoined streamers whose `profile_id` hasn't minted yet. Placeholder
   * rows still appear on the standings (sorted to the tail) and carry an
   * `alias` + `presentation` for display, but they have no detail page to
   * link to and no other rating data; consumers use `(profileId !== null)`
   * to gate the aoe2insights link in the player cell.
   */
  profileId: number | null
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
   * Highest rating reached on the tournament leaderboard. `null` for the
   * same unrated-member reason as `currentRating`.
   */
  maxRating: number | null
  wins: number
  losses: number
  /** Current win/loss streak as reported by the upstream ladder. */
  streak: number
  /**
   * Outcomes of the player's most recent completed matches, most-recent
   * first, capped at 10 by the API. Empty when they have no completed match.
   */
  recentResults: MatchResult[]
  /** Matches the player has completed within the tournament's date window. */
  gamesPlayed: number
  /** Position on the leaderboard, or null if unranked. */
  rank: number | null
  /** Total tracked players on the leaderboard, or null if unknown. */
  rankTotal: number | null
  /** Whether the player is in a live match right now. */
  inMatch: boolean
  /** ISO-8601 timestamp of the player's most recent match, or null. */
  lastMatchAt: string | null
  /**
   * ISO-8601 timestamp of when this row was last refreshed upstream, or
   * `null` for placeholder rows — they carry no polled refresh signal.
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
