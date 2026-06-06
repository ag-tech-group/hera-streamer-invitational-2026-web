import {
  Crown,
  ExternalLink,
  Globe,
  Skull,
  Twitch,
  Youtube,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useCountUp } from "@/hooks/use-count-up"
import { useHoverCapable } from "@/hooks/use-hover-capable"
import {
  flagEmojiToCountryCode,
  formatRelativeTime,
  normalizeCountryCode,
} from "@/lib/format"
import { useAnalytics } from "@/lib/analytics"
import { type TeamColorSlot } from "@/lib/team-colors"
import { cn } from "@/lib/utils"
import { PlayerName } from "@/pages/home/player-name"
import { RecentMatchupHint } from "@/pages/home/recent-matchup-hint"
import { isOffGameStream } from "@/pages/home/standings-stream"
import { WatchHint } from "@/pages/home/watch-hint"
import { WinPctHint } from "@/pages/home/win-pct-hint"
import type { RecentMatchup, StandingsTeam } from "@/types"

/**
 * Presentational standings cells, shared by the desktop table
 * (`standings-table.tsx`) and the mobile list (`standings-mobile-list.tsx`).
 * Each renders inline (`<span>`-based) content with no table wrapper, so the
 * desktop table drops them into `<td>`s and the mobile view drops the same
 * components into flex rows / a definition list — one source of truth for how a
 * rating, streak, or stream link looks, wherever it appears.
 */

/** A player's last match shows as recent (green) if it landed within this window. */
export const RECENT_WITHIN_MS = 24 * 60 * 60 * 1000

/**
 * Stream-platform classification for `presentation.streamUrls` (#152, #112) —
 * Twitch and YouTube get their brand icons; everything else falls back to a
 * generic external-link glyph. Same icon vocabulary `HostLinksCard` uses for
 * the sidebar's promotional links.
 */
type StreamPlatform = "twitch" | "youtube" | "other"

const STREAM_ICON: Record<StreamPlatform, LucideIcon> = {
  twitch: Twitch,
  youtube: Youtube,
  other: ExternalLink,
}

function streamPlatform(url: string): StreamPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === "twitch.tv" || host.endsWith(".twitch.tv")) return "twitch"
    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    ) {
      return "youtube"
    }
    return "other"
  } catch {
    // Malformed URLs fall back to the generic link icon rather than throwing
    // — the API doesn't validate the bag contents.
    return "other"
  }
}

/**
 * Tournament position — the row's 1-based place. The top three render
 * as filled brand-blue podium chips with descending fill intensity
 * (1st full, 2nd 30%, 3rd 15%); positions 4+ render as plain muted text
 * so the podium reads as a distinct broadcast-style tier above the
 * rest of the field.
 */
export function PositionCell({ position }: { position: number }) {
  if (position < 1 || position > 3) {
    return (
      <span className="text-muted-foreground tabular-nums">
        {position || "—"}
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        position === 1 && "bg-brand text-brand-foreground",
        position === 2 && "bg-brand/30 text-brand",
        position === 3 && "bg-brand/15 text-brand"
      )}
    >
      {position}
    </span>
  )
}

/**
 * The player's team: initials in a team-coloured chip (the team's AoE2 colour,
 * matching the Teams tab), full team name on hover. A player with no team shows
 * a neutral placeholder. Replaces the global ladder rank (#146) — team
 * affiliation is more relevant than overall ladder position for a team event,
 * and the Position column already carries tournament place.
 */
export function TeamCell({
  team,
  colorSlot,
}: {
  team: StandingsTeam | null
  /** Creation-order colour slot for this team (#231), from the table-level map. */
  colorSlot: TeamColorSlot | undefined
}) {
  if (team === null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span
      // `data-team-color` aliases the generic --team-color-* vars (index.css),
      // the same recipe the Teams-tab panels use, so the chip paints blue or
      // red without per-team styling here.
      data-team-color={colorSlot}
      className="ring-border inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide ring-1 ring-inset"
      style={{
        background: "var(--team-color-bg)",
        color: "var(--team-color-strong)",
      }}
      title={team.name}
    >
      {team.initials}
    </span>
  )
}

/**
 * Player flag: the `flag-icons` SVG for an ISO country code, a raw emoji for a
 * non-standard presentation override, or a globe fallback.
 *
 * `flagOverride` is rendered as-is — typically a country emoji from the
 * presentation bag — and wins over the ISO-code SVG flag when set. The frontend
 * doesn't interpret what the override carries so the host can swap in a
 * non-national glyph (rainbow flag, regional emoji, etc.) without a code change.
 *
 * Country flag emojis don't render as glyphs on Windows (no font for the
 * regional-indicator range), so a standard `presentation.flag` is routed back
 * through the SVG pipeline when it decomposes to an ISO code. Non-standard flag
 * emojis (rainbow, pirate, tag sequences, …) fail decomposition and fall
 * through to text rendering, which still looks correct everywhere modern
 * Windows ships glyphs for them.
 */
export function PlayerFlag({
  country,
  flagOverride,
  name,
}: {
  country: string | null
  flagOverride?: string
  /** Used as the text-override's accessible label (the visible player name). */
  name: string
}) {
  const countryCode = normalizeCountryCode(country)
  const overrideCode = flagOverride
    ? flagEmojiToCountryCode(flagOverride)
    : null
  const effectiveFlagCode = overrideCode ?? countryCode
  const renderOverrideAsText = Boolean(flagOverride && !overrideCode)

  if (effectiveFlagCode) {
    return (
      <span
        className={`fi fi-${effectiveFlagCode} ring-border shrink-0 rounded-[2px] text-base ring-1 ring-inset`}
        title={effectiveFlagCode.toUpperCase()}
        aria-hidden
      />
    )
  }
  if (renderOverrideAsText) {
    return (
      <span className="shrink-0 text-base leading-none" aria-label={name}>
        {flagOverride}
      </span>
    )
  }
  return <Globe className="text-muted-foreground size-4 shrink-0" aria-hidden />
}

/**
 * Player identity: flag (or globe fallback) and visible name, plus a pulsing
 * "Live" badge when the player is in a match right now. The visible name comes
 * from `displayName` when the host has set a presentation override (#152);
 * otherwise it falls back to the unified `name` (#187). The name itself — its
 * profile link (#131), bio disclosure, and analytics — is the shared
 * `PlayerName` (#350); the raw `alias` rides along for analytics.
 */
export function PlayerCell({
  profileId,
  name,
  alias,
  displayName,
  country,
  flagOverride,
  bio,
  profileUrl,
  inMatch,
}: {
  /** Relic profile id, or null for an unlinked entrant — carried for analytics. */
  profileId: number | null
  /** Unified display label (#187) — the fallback when no override is set. */
  name: string
  /** Raw ladder handle — the aoe2insights search + analytics use it, not display. */
  alias: string
  displayName?: string
  country: string | null
  flagOverride?: string
  /** Host-authored bio from the presentation bag; shows an info affordance when set. */
  bio?: string
  /**
   * Host-curated profile link from the presentation bag (#131). When set the
   * name links straight to it; when absent the name is plain text — we don't
   * derive a link from the relic profile_id because it doesn't match
   * aoe2insights' internal URL id.
   */
  profileUrl?: string
  inMatch: boolean
}) {
  const visibleName = displayName ?? name
  return (
    <span className="flex items-center gap-2">
      <PlayerFlag
        country={country}
        flagOverride={flagOverride}
        name={visibleName}
      />
      {/*
       * Name + profile link + bio disclosure are the shared `PlayerName` (#350),
       * the same component the teams pill uses so the two surfaces can't drift.
       * `source` tags this surface's analytics; the table keeps the name on one
       * line (no `truncate`).
       */}
      <PlayerName
        name={visibleName}
        alias={alias}
        profileId={profileId}
        bio={bio}
        profileUrl={profileUrl}
        source="standings"
      />
      {inMatch && <LiveBadge />}
    </span>
  )
}

/**
 * Pulsing brand-blue dot — the table's "happening right now" glyph, shared by
 * the in-match `LiveBadge` and the live-stream indicator. Decorative
 * (`aria-hidden`); callers that need an accessible name wrap it with one.
 */
export function LiveDot({
  tone = "brand",
  className,
}: {
  /** Dot colour — `brand` (live on AoE2 / in a match) or `foreground` (off-game). */
  tone?: "brand" | "foreground"
  className?: string
}) {
  const bg = tone === "foreground" ? "bg-foreground" : "bg-brand"
  return (
    <span className={cn("relative flex size-1.5", className)} aria-hidden>
      <span
        className={cn(
          "absolute inline-flex size-full animate-ping rounded-full opacity-75",
          bg
        )}
      />
      <span className={cn("relative inline-flex size-1.5 rounded-full", bg)} />
    </span>
  )
}

/**
 * "Live" badge for a player currently in a match. The ping ring is the table's
 * focal moment — who to go watch right now. Driven by `in_match`, which a
 * `live` SSE nudge keeps fresh (see `useLiveUpdates`).
 */
export function LiveBadge() {
  const { t } = useTranslation()
  return (
    <span
      className="bg-brand/15 text-brand inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
      aria-label={t("standings.liveAriaLabel")}
    >
      <LiveDot />
      {t("standings.live")}
    </span>
  )
}

/**
 * Renders a numeric value that tweens toward `value` whenever it changes.
 * Wraps the standings table's rating cell so a change-by-12 reads as a
 * count-up rather than a discrete jump.
 */
export function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>
}

/**
 * Win/loss streak. The upstream ladder reports a signed integer: positive is a
 * run of wins, negative a run of losses, zero none.
 *
 * Visual intensity scales with magnitude: streaks of 1–2 stay at the original
 * subtle tint, 3–4 step up to a stronger fill, and 5+ pick up a ring and a
 * coloured halo so a "hot streak" reads from across the room. Same colour
 * language as the recent-results pips (chart-2 for wins, destructive for
 * losses) — only the saturation escalates.
 */
export function StreakCell({ streak }: { streak: number }) {
  if (streak === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const winning = streak > 0
  const magnitude = Math.abs(streak)
  const tier = magnitude >= 5 ? "high" : magnitude >= 3 ? "med" : "low"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        // Thin muted outline to gently define the badge edge — the app's
        // subtle border token (same ring as the team chips), not a hard white.
        "ring-border ring-1 ring-inset",
        // Text uses the `-deep` variant (darker in light theme, lighter
        // in dark theme) so the W / L label clears WCAG AA contrast
        // against the tinted background. Base chart-2 / destructive
        // sit too close to the badge bg luminance for the small-text
        // 4.5:1 threshold.
        winning ? "text-chart-2-deep" : "text-destructive-deep",
        tier === "low" && (winning ? "bg-chart-2/10" : "bg-destructive/10"),
        tier === "med" && (winning ? "bg-chart-2/20" : "bg-destructive/20"),
        // High tier keeps its coloured glow (box-shadow, below); the muted
        // outline above stands in for the previous coloured ring.
        tier === "high" && (winning ? "bg-chart-2/30" : "bg-destructive/30")
      )}
      style={
        tier === "high"
          ? {
              boxShadow: `0 0 10px color-mix(in oklch, var(${winning ? "--chart-2" : "--destructive"}) 50%, transparent)`,
            }
          : undefined
      }
    >
      {`${winning ? "W" : "L"} ${magnitude}`}
    </span>
  )
}

/** How many of the most-recent games the Recent column shows. */
const RECENT_MATCHUPS_LIMIT = 6

/**
 * Recent form: a compact row of win/loss pips, most-recent first. Greens are
 * wins and reds losses — the same colour language as the streak badge. A
 * player with no completed game shows a neutral placeholder.
 *
 * Each pip is also a hover/tap disclosure (#339): the row reads as W/L at a
 * glance, but hovering (desktop) or tapping (mobile) any pip floats a card with
 * that game's civ matchup — player civ `vs` opponent civ, plus the map and how
 * long ago — driven by the richer `recentMatchups` field. See
 * `RecentMatchupHint`.
 */
export function RecentMatchupsCell({
  matchups,
  now,
}: {
  matchups: RecentMatchup[]
  now: Date
}) {
  // One read per cell, shared by every pip so the spacing and the per-pip
  // disclosure primitive can't disagree: a mouse keeps the pips tight (`gap-1`,
  // no per-pip padding — the original W/L row's look); a finger spreads them for
  // tappable targets, the `-my-1` cancelling the padding's vertical growth.
  const hoverCapable = useHoverCapable()
  if (matchups.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  // Cap to the last N games. `matchups` is most-recent-first, so the first N
  // are the latest; the visible slice stays newest → oldest, left → right.
  const visible = matchups.slice(0, RECENT_MATCHUPS_LIMIT)
  return (
    <span
      className={cn(
        "flex items-center",
        hoverCapable ? "gap-1" : "-my-1 gap-0.5"
      )}
    >
      {visible.map((matchup, index) => {
        // Crown for a win, skull for a loss: the broadcast vocabulary, coloured
        // with the same win/loss tokens the streak badge uses so the form
        // language stays consistent across cells.
        const Icon = matchup.outcome === "win" ? Crown : Skull
        // Direction cue without extra chrome: the newest game (index 0, left)
        // is full-strength and each older one fades a step, so "bright = now"
        // reads at a glance. Floored at 0.4 so the oldest still stays legible.
        const opacity = Math.max(0.4, 1 - index * 0.12)
        return (
          // Index key: matchups are positional (newest-first) and append at the
          // front, matching how the pips have always been keyed.
          <RecentMatchupHint
            key={index}
            matchup={matchup}
            now={now}
            hoverCapable={hoverCapable}
          >
            <Icon
              aria-hidden
              style={{ opacity }}
              // Light the pip up: a slight scale plus a colour-matched glow
              // (`drop-shadow` of `currentColor`, so a win glows green and a loss
              // red). A stronger cue than the brightness filter the name and win%
              // triggers use — the pips are small and the older ones are dimmed by
              // `opacity`, so a brightness bump barely shows; the scale (immune to
              // that opacity) keeps every pip reacting, recent or old.
              //
              // Driven from the wrapping button (its `.group`), not the glyph's
              // own `:hover` — scaling the hovered element perturbs its hit-region
              // and flickers. Two triggers, same effect: `group-hover` for the
              // mouse (instant), and `group-data-[state=open]` for touch, where
              // there's no hover — so the tapped pip lights up to show which game
              // the open card describes (#348, replacing the missing tooltip
              // arrow). `pointer-events-none` keeps the growing glyph out of
              // hit-testing so the button's fixed box stays the stable region.
              className={cn(
                "pointer-events-none size-3.5 transition",
                "group-hover:scale-125 group-hover:drop-shadow-[0_0_5px_currentColor]",
                "group-data-[state=open]:scale-125 group-data-[state=open]:drop-shadow-[0_0_5px_currentColor]",
                matchup.outcome === "win"
                  ? "text-chart-2-deep"
                  : "text-destructive-deep"
              )}
            />
          </RecentMatchupHint>
        )
      })}
    </span>
  )
}

/**
 * The Win% cell: the API-computed tournament-window percentage
 * (`row.winPct`, #238) with a hover/tap breakdown of the underlying W–L split.
 * Renders a muted em-dash when `winPct` is null — no in-window decided games —
 * matching the other empty-state cells, and skips the tooltip there since
 * there's nothing to break down. The breakdown's wins/losses are also
 * tournament-scoped (mapped from `tournament_record` in the adapter).
 */
export function WinPctCell({
  winPct,
  wins,
  losses,
}: {
  winPct: number | null
  wins: number
  losses: number
}) {
  if (winPct === null) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  return (
    <WinPctHint wins={wins} losses={losses}>
      {winPct.toFixed(1)}%
    </WinPctHint>
  )
}

/**
 * The "Last match" cell: the relative time since a player's last completed
 * tournament match (e.g. "4h"), led by a coloured dot — green when that match
 * landed within the last 24h, grey when older. A player with no recorded match
 * shows a neutral placeholder. The column header names the metric, so the badge
 * carries the timestamp alone. Tracks match *completion*, so "playing right
 * now" lives on the separate Live badge, not here.
 */
export function LastMatchCell({
  lastMatchAt,
  now,
}: {
  lastMatchAt: string | null
  now: Date
}) {
  if (!lastMatchAt) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const isRecent =
    now.getTime() - new Date(lastMatchAt).getTime() <= RECENT_WITHIN_MS
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        isRecent
          ? "bg-chart-2/10 text-chart-2-deep"
          : "bg-muted text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isRecent ? "bg-chart-2" : "bg-muted-foreground/50"
        )}
      />
      {/* No opacity on the time: the badge text colour already meets AA on its
          background, but opacity-70 dropped it under the 4.5:1 ratio for this
          small text (#73 / #65 audit). */}
      <span className="tabular-nums">
        {formatRelativeTime(lastMatchAt, now)}
      </span>
    </span>
  )
}

/**
 * "Watch Live" affordance: a row of platform-icon links to the player's
 * stream channels (from `presentation.streamUrls`, #152). When the API
 * reports `stream_live` (#112) the icons brighten to the brand colour and a
 * small pulsing dot appears alongside — signalling "they're broadcasting
 * right now, click to go watch." Players with no channels show the same
 * muted em-dash the table's other empty cells use.
 *
 * #328 layers on *what* they're streaming: the broadcast `streamTitle` (plus
 * the Twitch `streamCategory`) rides each icon's hover card, and a third colour
 * tier turns the live signal trustworthy — brand-blue on AoE2 (or when we can't
 * tell), white when confirmed off-game, muted when offline.
 */
export function WatchCell({
  streamUrls,
  streamLive,
  streamTitle,
  streamCategory,
  profileId,
  alias,
}: {
  streamUrls: string[] | undefined
  streamLive: boolean
  /** Live broadcast title (Twitch, or YouTube fallback); null offline/omitted. */
  streamTitle: string | null
  /** Live game category — Twitch-only, so null for YouTube or when omitted (#328). */
  streamCategory: string | null
  profileId: number | null
  alias: string
}) {
  const { t } = useTranslation()
  const analytics = useAnalytics()
  if (!streamUrls || streamUrls.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  // `offGame` = a *confirmed* off-game live stream: a non-null category that
  // isn't AoE2 (e.g. "Just Chatting", "Path of Exile 2"). It drops the icons +
  // dot from brand to a neutral white tier — still visibly live, just not our
  // game. A null category — YouTube has none, and Twitch can omit it — stays on
  // brand, so we never demote a channel we simply can't classify (#328).
  const offGame = isOffGameStream(streamLive, streamCategory)
  return (
    // `-my-1.5` cancels the link padding's vertical growth so the row height is
    // unchanged while each Watch link gets a ~40px tap target (#214).
    <span className="-my-1.5 inline-flex items-center justify-center">
      {streamUrls.map((url) => {
        const platform = streamPlatform(url)
        const Icon = STREAM_ICON[platform]
        const watchLabel = t(`standings.watchOn.${platform}`)
        // Category is Twitch-only and only meaningful on the Twitch icon (#328).
        const tooltipCategory = platform === "twitch" ? streamCategory : null
        // The accessible name stays the stable "Watch on <platform>" action; the
        // live title/category live in the hover card, so a screen reader hears
        // the action, not a churning broadcast title (#328).
        const link = (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={watchLabel}
            // #215: the headline "go watch" conversion. Fired in the click
            // handler (not an effect) so it logs once per real click.
            onClick={() =>
              analytics.track("watch.click", {
                profileId,
                alias,
                platform,
                streamLive,
                source: "standings",
              })
            }
            // Three tiers (#328): brand when live on AoE2, white when live but
            // off-game, muted when offline. Hover brightens each icon in place
            // (a filter, not a colour swap) so the white off-game icon never
            // flashes brand-blue. Padding grows the tap target past the glyph
            // (#214); the wrapper's negative margin keeps the cell from getting
            // taller.
            className={cn(
              "inline-flex p-2 transition hover:brightness-125",
              !streamLive
                ? "text-muted-foreground"
                : offGame
                  ? "text-foreground"
                  : "text-brand"
            )}
          >
            <Icon className="size-4" aria-hidden />
          </a>
        )
        // A live stream with something to say gets the styled hover card; an
        // offline icon (or a live row missing both title and category) keeps the
        // bare link — nothing to disclose.
        return streamLive && (streamTitle || tooltipCategory) ? (
          <WatchHint
            key={url}
            title={streamTitle}
            category={tooltipCategory}
            offGame={offGame}
          >
            {link}
          </WatchHint>
        ) : (
          link
        )
      })}
      {streamLive && (
        // Pulsing dot = "broadcasting right now". Its colour carries the #328
        // trust signal: brand-blue when the stream is — or plausibly is — on
        // AoE2, white when we can *confirm* it's off-game. `role="img"` lets the
        // wrapper own a category-aware label for assistive tech (a bare <span>
        // can't — aria-prohibited-attr, flagged in the #65 audit), so screen
        // readers get the same signal the colour conveys.
        <span
          role="img"
          className="relative inline-flex size-1.5"
          aria-label={
            streamCategory
              ? t("standings.streamingCategory", { category: streamCategory })
              : t("standings.streamingLive")
          }
        >
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75",
              offGame ? "bg-foreground" : "bg-brand"
            )}
          />
          <span
            className={cn(
              "relative inline-flex size-1.5 rounded-full",
              offGame ? "bg-foreground" : "bg-brand"
            )}
          />
        </span>
      )}
    </span>
  )
}

/**
 * Compact, **non-interactive** Watch indicator for the mobile metric column.
 * That column sits inside the collapsed row's expand `<button>`, so it can hold
 * no links — this mirrors `WatchCell`'s three live tiers as plain glyphs (brand
 * + pulsing dot when live on, or plausibly on, AoE2; white when confirmed
 * off-game; muted when offline) with an `sr-only` summary. The tappable stream
 * links live in the expanded panel's full `WatchCell`.
 */
export function WatchMetric({
  streamUrls,
  streamLive,
  streamCategory,
}: {
  streamUrls: string[] | undefined
  streamLive: boolean
  streamCategory: string | null
}) {
  const { t } = useTranslation()
  if (!streamUrls || streamUrls.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const offGame = isOffGameStream(streamLive, streamCategory)
  // De-dupe platforms so two Twitch URLs show a single glyph.
  const platforms = Array.from(new Set(streamUrls.map(streamPlatform)))
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        !streamLive
          ? "text-muted-foreground"
          : offGame
            ? "text-foreground"
            : "text-brand"
      )}
    >
      {platforms.map((platform) => {
        const Icon = STREAM_ICON[platform]
        return <Icon key={platform} className="size-4" aria-hidden />
      })}
      <span className="sr-only">
        {streamLive
          ? streamCategory
            ? t("standings.streamingCategory", { category: streamCategory })
            : t("standings.streamingLive")
          : t("standings.streamOffline")}
      </span>
    </span>
  )
}
