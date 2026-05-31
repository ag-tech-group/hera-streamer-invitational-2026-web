import {
  Crown,
  ExternalLink,
  Globe,
  Skull,
  Twitch,
  Youtube,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useMemo, useRef } from "react"
import type { ReactNode, Ref } from "react"
import { useTranslation } from "react-i18next"

import { SortableTh } from "@/components/sortable-th"
import { Skeleton } from "@/components/ui/skeleton"
import { useCountUp } from "@/hooks/use-count-up"
import { useFlashOnChange } from "@/hooks/use-flash-on-change"
import {
  useTableSort,
  type SortableValue,
  type SortDirection,
  type SortState,
} from "@/hooks/use-table-sort"
import {
  flagEmojiToCountryCode,
  formatRelativeTime,
  normalizeCountryCode,
} from "@/lib/format"
import { teamColorSlot } from "@/lib/team-colors"
import { cn } from "@/lib/utils"
import { BioHint } from "@/pages/home/bio-hint"
import { useFlipRows } from "@/pages/home/use-flip-rows"
import { WinPctHint } from "@/pages/home/win-pct-hint"
import type { MatchResult, StandingsRow, StandingsTeam } from "@/types"

/** A player's last match counts as "active" if it landed within this window. */
const ACTIVE_WITHIN_MS = 24 * 60 * 60 * 1000

/** Placeholder row count rendered while the standings request is in flight. */
const SKELETON_ROW_COUNT = 6

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
 * Stable per-row identifier for React keys, FLIP animation tracking, and
 * the position map. Real roster members key off their `profileId`;
 * placeholder rows (`profileId: null`) — announced-but-unjoined streamers
 * — fall back to their `alias`, which the API guarantees is unique within
 * a tournament's roster. The `id:` / `placeholder:` prefixes prevent a
 * profile id that happens to equal another row's alias from colliding.
 */
function rowKey(row: StandingsRow): string {
  return row.profileId !== null
    ? `id:${row.profileId}`
    : `placeholder:${row.alias}`
}

/**
 * The polished standings table. A pure presentation component: it renders the
 * rows it is handed and owns no fetching or query state — `HomePage` decides
 * when a populated table is the right thing to show (vs. loading/empty/error).
 *
 * Every column renders at all times. (Games + Recent were previously hidden
 * until the tournament's start date passed; that gate was removed so the full
 * table shows from the start — pre-start those cells just read as 0 / empty.)
 */
export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  const { t } = useTranslation()
  // One reference instant for the whole render, so every "time ago" in the
  // Activity column is measured against the same clock.
  const now = new Date()

  // Tournament position ranks by peak (max) rating (#197), so re-rank the
  // incoming rows here rather than trusting the API's order — this drives both
  // the default view order and the Position column. `rows` stays the source of
  // truth; `rankedRows` is a stable, derived ordering.
  const rankedRows = useMemo(() => [...rows].sort(comparePeakRank), [rows])

  const { sortedRows, sortState, sortBy } = useTableSort(
    rankedRows,
    getSortValue
  )

  // FLIP animation: rows slide to their new spots whenever the order
  // changes (either from a live SSE refresh or a header click). Keyed off
  // the same `rowKey` the `<tr>` uses so placeholder rows (null
  // `profileId`) don't collide on a single `null` identifier.
  const orderKey = sortedRows.map(rowKey).join(",")
  const { containerRef, registerRow } = useFlipRows(orderKey)

  // The Position column shows the row's tournament rank — its place in the
  // peak-rating order (`rankedRows`), not the current sorted view. Without
  // this, sorting by another column would relabel "Position 1" as the top of
  // that sort instead of the tournament leader. Keyed by `rowKey` so multiple
  // placeholder rows (all with `profileId: null`) each get their own position
  // rather than overwriting one Map entry.
  const positionMap = useMemo(() => {
    const map = new Map<string, number>()
    rankedRows.forEach((row, i) => map.set(rowKey(row), i + 1))
    return map
  }, [rankedRows])

  return (
    <TableShell
      caption={t("standings.caption")}
      bodyRef={containerRef}
      headerRow={<StandingsHeaderRow sortState={sortState} onSort={sortBy} />}
    >
      {sortedRows.map((row) => {
        const key = rowKey(row)
        const position = positionMap.get(key) ?? 0
        const isLeader = position === 1
        return (
          <tr
            key={key}
            data-flip-id={key}
            ref={registerRow}
            // Tag the row with its team's colour slot (#146). A thin left
            // accent bar is painted in index.css via a pseudo-element layer
            // keyed on this attribute, so it composes over the leader
            // spotlight, the row hover, and the cell change-flash instead of
            // replacing them; here we just tag the row.
            data-team-color={
              row.team ? teamColorSlot(row.team.teamId) : undefined
            }
            className={cn(
              "border-b transition-colors last:border-b-0",
              // Leader row carries a pulsing brand-tinted bg; non-leaders
              // get a brand-tinted hover (was muted before — the brand
              // tint matches the broadcast atmosphere on the rest of the
              // page rather than fading to neutral gray).
              isLeader ? "rank-1-spotlight" : "hover:bg-brand/6"
            )}
          >
            <td className="px-4 py-3">
              <PositionCell position={position} />
            </td>
            <td className="px-4 py-3">
              <TeamCell team={row.team} />
            </td>
            <td className="px-4 py-3">
              <PlayerCell
                alias={row.alias}
                displayName={row.presentation.displayName}
                country={row.country}
                flagOverride={row.presentation.flag}
                bio={row.presentation.bio}
                profileUrl={row.presentation.profileUrl}
                inMatch={row.inMatch}
              />
            </td>
            {/*
             * Peak (max) rating is the ranked, headline number (#197), so it
             * takes the same Bebas Neue + size-bump treatment the team-panel
             * combined-rating got in #119. Drops `font-medium` because the
             * display face ships at weight 400 only; bumps to text-lg +
             * tracking-wide so the condensed glyphs read at the same visual
             * weight as the surrounding sans data — the rest of the row stays
             * at text-sm so the peak still wins hierarchy.
             */}
            <FlashCell
              value={row.maxRating}
              className="font-display px-4 py-3 text-right text-lg tracking-wide tabular-nums"
            >
              {/*
               * Null peak = unrated roster member (left-joined onto the
               * standings; the API sorts these to the tail). Render the same
               * muted em-dash the streak / recent / activity cells use for
               * their empty state rather than a count-up of nothing.
               */}
              {row.maxRating === null ? (
                <span className="text-muted-foreground text-xs">—</span>
              ) : (
                <CountUp value={row.maxRating} />
              )}
            </FlashCell>
            {/* Current rating drops to the muted secondary column to the
                right of the headline peak (#197). */}
            <FlashCell
              value={row.currentRating}
              className="text-muted-foreground px-4 py-3 text-right tabular-nums"
            >
              {row.currentRating === null ? (
                <span className="text-muted-foreground text-xs">—</span>
              ) : (
                row.currentRating
              )}
            </FlashCell>
            <FlashCell
              value={row.gamesPlayed}
              className="text-muted-foreground px-4 py-3 text-right tabular-nums"
            >
              {row.gamesPlayed}
            </FlashCell>
            {/* Win% sits right after Games. Tooltip breaks down the W–L
                split behind the percentage (hover desktop / tap mobile). */}
            <FlashCell
              value={row.wins - row.losses}
              className="px-4 py-3 text-right tabular-nums"
            >
              <WinPctCell wins={row.wins} losses={row.losses} />
            </FlashCell>
            <td className="px-4 py-3">
              <RecentResultsCell results={row.recentResults} />
            </td>
            {/* Streak sits adjacent to Recent — both are "recent form". */}
            <FlashCell value={row.streak} className="px-4 py-3 text-center">
              <StreakCell streak={row.streak} />
            </FlashCell>
            <td className="px-4 py-3">
              <ActivityCell lastMatchAt={row.lastMatchAt} now={now} />
            </td>
            <td className="px-4 py-3 text-center">
              <WatchCell
                streamUrls={row.presentation.streamUrls}
                streamLive={row.streamLive}
              />
            </td>
          </tr>
        )
      })}
    </TableShell>
  )
}

/**
 * `<td>` that briefly flashes its background whenever `value` changes between
 * renders — how the standings table draws the eye to a number that just
 * shifted via an SSE refetch. Each cell tracks its own previous value
 * internally, so newly-mounted cells (e.g. a player joining mid-tournament)
 * don't flash on first paint. Padding and alignment come from the caller's
 * `className`, so this is a drop-in for any of the numeric/badge cells.
 */
function FlashCell({
  value,
  className,
  children,
}: {
  value: unknown
  className: string
  children: ReactNode
}) {
  const ref = useRef<HTMLTableCellElement>(null)
  useFlashOnChange(ref, value)
  return (
    <td ref={ref} className={className}>
      {children}
    </td>
  )
}

/**
 * Renders a numeric value that tweens toward `value` whenever it changes.
 * Wraps the standings table's rating cell so a change-by-12 reads as a
 * count-up rather than a discrete jump.
 */
function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>
}

/** Maps a sort key onto the `StandingsRow` field it ranks by. */
function getSortValue(row: StandingsRow, key: string): SortableValue {
  switch (key) {
    case "team":
      // Sort groups players by team (by initials); the un-teamed sort last.
      return row.team?.initials ?? null
    case "alias":
      return row.alias
    case "currentRating":
      return row.currentRating
    case "maxRating":
      return row.maxRating
    case "streak":
      return row.streak
    case "gamesPlayed":
      return row.gamesPlayed
    case "winPct":
      // Rows with no decided games sort last (null) rather than as 0% — a
      // 0-game placeholder shouldn't outrank a real 50% record.
      return winPct(row)
    case "lastMatchAt":
      return row.lastMatchAt
    case "watch":
      return watchSortRank(row)
    default:
      return null
  }
}

/**
 * Watchability rank for the Watch column sort: 2 = a stream is live right now,
 * 1 = has a channel but it's offline, 0 = no channel at all. A `desc` sort
 * (the header's default) surfaces "who can I go watch" at the top, then the
 * rest of the streamers, then the channel-less rows — mirroring the tiering
 * `WatchCell` already paints. `streamLive` can only be true when `streamUrls`
 * is non-empty (the API derives it from those URLs), so the tiers never
 * contradict each other.
 */
function watchSortRank(row: StandingsRow): number {
  if (row.streamLive) return 2
  return (row.presentation.streamUrls?.length ?? 0) > 0 ? 1 : 0
}

/**
 * Ranks two rows for tournament position by peak (max) rating, descending
 * (#197). Nulls (unrated roster members) pin to the tail, matching the sort
 * hook's null handling; ties break on current rating, then alias, so a shared
 * peak still orders by who's higher right now and the result is deterministic.
 */
function comparePeakRank(a: StandingsRow, b: StandingsRow): number {
  return (
    descNullsLast(a.maxRating, b.maxRating) ||
    descNullsLast(a.currentRating, b.currentRating) ||
    a.alias.localeCompare(b.alias)
  )
}

/**
 * Descending numeric compare that always sorts `null` last regardless of the
 * other operand, so unrated rows sink to the tail instead of floating to the
 * top of a descending order. Returns 0 for equal (or both-null) values so
 * callers can chain to a tiebreaker with `||`.
 */
function descNullsLast(a: number | null, b: number | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

/**
 * Header row for the players standings, shared between the populated
 * table (passes sort state + handler) and the loading skeleton (omits
 * both, so `SortableTh` renders plain headers).
 */
function StandingsHeaderRow({
  sortState,
  onSort,
}: {
  sortState?: SortState | null
  onSort?: (key: string, defaultDirection: SortDirection) => void
}) {
  const { t } = useTranslation()
  return (
    <tr className="text-muted-foreground font-display border-b text-left text-sm tracking-widest uppercase">
      <SortableTh label={t("standings.headers.position")} />
      <SortableTh
        label={t("standings.headers.team")}
        sortKey="team"
        defaultDirection="asc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("standings.headers.player")}
        sortKey="alias"
        defaultDirection="asc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("standings.headers.peak")}
        align="right"
        sortKey="maxRating"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("standings.headers.rating")}
        align="right"
        sortKey="currentRating"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("standings.headers.games")}
        align="right"
        sortKey="gamesPlayed"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("standings.headers.winPct")}
        align="right"
        sortKey="winPct"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh label={t("standings.headers.recent")} />
      <SortableTh
        label={t("standings.headers.streak")}
        align="center"
        sortKey="streak"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("standings.headers.activity")}
        sortKey="lastMatchAt"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("standings.headers.watch")}
        align="center"
        sortKey="watch"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
    </tr>
  )
}

/**
 * Loading placeholder for the standings table. Renders through the same
 * `TableShell` and column count as the real table, so data arriving causes no
 * layout shift. Renders the same full column set as the real table.
 */
export function StandingsTableSkeleton() {
  const { t } = useTranslation()
  return (
    <TableShell
      caption={t("standings.captionLoading")}
      headerRow={<StandingsHeaderRow />}
    >
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <tr key={index} className="border-b last:border-b-0">
          {/*
           * Position placeholder is chip-shaped (h-5 w-7 rounded-md) so the
           * loading state and the real podium chips share the same footprint,
           * preventing a layout shift on data arrival.
           */}
          <td className="px-4 py-3">
            <Skeleton className="h-5 w-7 rounded-md" />
          </td>
          <td className="px-4 py-3">
            {/* Team-initials chip placeholder — matches the TeamCell chip
                footprint so data arrival doesn't shift the row. */}
            <Skeleton className="h-5 w-8 rounded-md" />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-[1.333rem] rounded-[2px]" />
              <Skeleton className="h-4 w-28" />
            </div>
          </td>
          {/*
           * Peak placeholder is taller (h-6) than the current-rating one
           * (h-4) because the headline peak now uses the display face at
           * text-lg (#197) — keeping the skeleton at h-4 would shift the row
           * taller on data arrival.
           */}
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-6 w-14" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-12" />
          </td>
          {/* Games placeholder */}
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-8" />
          </td>
          {/* Win% placeholder */}
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-12" />
          </td>
          {/* Recent placeholder */}
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* Streak placeholder — follows Recent, matching the populated row
              order. */}
          <td className="px-4 py-3">
            <Skeleton className="mx-auto h-5 w-10" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-5 w-24 rounded-full" />
          </td>
          {/* Watch column placeholder — two icon-sized chips for the typical
              "Twitch + YouTube" layout. Width matches the populated cell so
              loading doesn't shift the table. */}
          <td className="px-4 py-3">
            <Skeleton className="mx-auto h-4 w-14" />
          </td>
        </tr>
      ))}
    </TableShell>
  )
}

/**
 * Shared chrome — bordered container, table element — so the populated
 * table and its loading skeleton can never drift out of alignment. The
 * header row is passed in so each caller (populated vs. skeleton) can wire
 * sort state where appropriate; the broadcast caps treatment lives on the
 * `<tr>` itself (see `StandingsHeaderRow`).
 *
 * The frame mirrors the team-panel chrome (#114): a brand-coloured accent
 * stripe along the top edge plus a soft brand-tinted glow blooming from
 * the upper-right corner. The horizontal scroll lives on an inner wrapper
 * so the chrome stays anchored to the card frame even when the table
 * overflows its container on narrow viewports.
 */
function TableShell({
  caption,
  bodyRef,
  headerRow,
  children,
}: {
  caption: string
  bodyRef?: Ref<HTMLTableSectionElement>
  headerRow: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bg-card shadow-card relative overflow-hidden rounded-lg">
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{
          background: "color-mix(in oklch, var(--brand) 12%, transparent)",
        }}
      />
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>{headerRow}</thead>
          <tbody ref={bodyRef}>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Tournament position — the row's 1-based place. The top three render
 * as filled brand-blue podium chips with descending fill intensity
 * (1st full, 2nd 30%, 3rd 15%); positions 4+ render as plain muted text
 * so the podium reads as a distinct broadcast-style tier above the
 * rest of the field.
 */
function PositionCell({ position }: { position: number }) {
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
function TeamCell({ team }: { team: StandingsTeam | null }) {
  if (team === null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span
      // `data-team-color` aliases the generic --team-color-* vars (index.css),
      // the same recipe the Teams-tab panels use, so the chip paints blue or
      // red without per-team styling here.
      data-team-color={teamColorSlot(team.teamId)}
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
 * Player identity: flag (or globe fallback) and visible name, plus a pulsing
 * "Live" badge when the player is in a match right now. The visible name
 * comes from `displayName` when the host has set a presentation override
 * (#152); otherwise it falls back to the raw ladder `alias`. The aoe2insights
 * link always uses the raw `alias` so the search lands on the actual ladder
 * profile, even when the host is displaying a friendlier name.
 *
 * `flagOverride` is rendered as-is — typically a country emoji from the
 * presentation bag — and wins over the ISO-code SVG flag when set. The
 * frontend doesn't interpret what the override carries so the host can swap
 * in a non-national glyph (rainbow flag, regional emoji, etc.) without a
 * code change.
 */
function PlayerCell({
  alias,
  displayName,
  country,
  flagOverride,
  bio,
  profileUrl,
  inMatch,
}: {
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
  const { t } = useTranslation()
  const countryCode = normalizeCountryCode(country)
  // Country flag emojis don't render as glyphs on Windows (no font for the
  // regional-indicator range), so route a standard `presentation.flag` back
  // through the `flag-icons` SVG pipeline when it decomposes to an ISO
  // code. Non-standard flag emojis (rainbow, pirate, tag sequences, …)
  // fail decomposition and fall through to text rendering, which still
  // looks correct everywhere modern Windows ships glyphs for them.
  const overrideCode = flagOverride
    ? flagEmojiToCountryCode(flagOverride)
    : null
  const effectiveFlagCode = overrideCode ?? countryCode
  const renderOverrideAsText = Boolean(flagOverride && !overrideCode)
  const visibleName = displayName ?? alias

  // The visible name links to the host-curated profile URL when set, otherwise
  // it's plain text — a link always means a real profile (#131). On
  // hover-capable devices this element doubles as the bio hover trigger, so
  // it's built once and handed to `BioHint`.
  const nameNode = profileUrl ? (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={t("standings.viewProfile", { name: visibleName })}
      className="text-brand font-medium whitespace-nowrap underline-offset-2 transition-colors hover:underline"
    >
      {visibleName}
    </a>
  ) : (
    // No profile URL set: keep the same weight + nowrap so the column rhythm
    // doesn't shift, but drop the brand colour so the name reads as plain text.
    <span className="font-medium whitespace-nowrap">{visibleName}</span>
  )

  return (
    <span className="flex items-center gap-2">
      {effectiveFlagCode ? (
        <span
          className={`fi fi-${effectiveFlagCode} ring-border shrink-0 rounded-[2px] text-base ring-1 ring-inset`}
          title={effectiveFlagCode.toUpperCase()}
          aria-hidden
        />
      ) : renderOverrideAsText ? (
        <span
          className="shrink-0 text-base leading-none"
          aria-label={visibleName}
        >
          {flagOverride}
        </span>
      ) : (
        <Globe className="text-muted-foreground size-4 shrink-0" aria-hidden />
      )}
      {/*
       * With a bio set, the name becomes the disclosure: hover it on desktop,
       * or tap the info icon `BioHint` adds beside it on touch. No bio → the
       * name renders bare.
       */}
      {bio ? (
        <BioHint bio={bio} name={visibleName}>
          {nameNode}
        </BioHint>
      ) : (
        nameNode
      )}
      {inMatch && <LiveBadge />}
    </span>
  )
}

/**
 * "Live" badge for a player currently in a match. The ping ring is the table's
 * focal moment — who to go watch right now. Driven by `in_match`, which a
 * `live` SSE nudge keeps fresh (see `useLiveUpdates`).
 */
function LiveBadge() {
  const { t } = useTranslation()
  return (
    <span
      className="bg-brand/15 text-brand inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
      aria-label={t("standings.liveAriaLabel")}
    >
      <span className="relative flex size-1.5" aria-hidden>
        <span className="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-75" />
        <span className="bg-brand relative inline-flex size-1.5 rounded-full" />
      </span>
      {t("standings.live")}
    </span>
  )
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
function StreakCell({ streak }: { streak: number }) {
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

/**
 * Recent form: a compact row of win/loss pips, most-recent first. Greens are
 * wins and reds losses — the same colour language as the streak badge. A
 * player with no completed match shows a neutral placeholder.
 */
/** How many of the most-recent games the Recent column shows. */
const RECENT_RESULTS_LIMIT = 6

function RecentResultsCell({ results }: { results: MatchResult[] }) {
  const { t } = useTranslation()
  if (results.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  // Cap to the last N games. `results` is most-recent-first, so the first N
  // are the latest; the visible slice stays newest → oldest, left → right.
  const visible = results.slice(0, RECENT_RESULTS_LIMIT)
  const labeled = visible
    .map((r) => (r === "win" ? t("standings.win") : t("standings.loss")))
    .join(", ")
  return (
    <span
      className="flex items-center gap-1"
      aria-label={t("standings.recentAriaLabel", { results: labeled })}
    >
      {visible.map((result, index) => {
        // Crown for a win, skull for a loss (#: broadcast vocabulary over the
        // old neutral squares). Coloured with the same win/loss tokens the
        // streak badge uses so the form language stays consistent across cells.
        const Icon = result === "win" ? Crown : Skull
        // Direction cue without extra chrome: the newest game (index 0, left)
        // is full-strength and each older one fades a step, so "bright = now"
        // reads at a glance. Floored at 0.4 so the oldest still stays legible.
        const opacity = Math.max(0.4, 1 - index * 0.12)
        return (
          <Icon
            key={index}
            aria-hidden
            style={{ opacity }}
            className={cn(
              "size-3.5",
              result === "win" ? "text-chart-2-deep" : "text-destructive-deep"
            )}
          >
            <title>
              {result === "win" ? t("standings.win") : t("standings.loss")}
            </title>
          </Icon>
        )
      })}
    </span>
  )
}

/**
 * Win percentage from decided games (wins / (wins + losses)), or null when the
 * player has no decided games — so a 0-game placeholder reads as "—" rather
 * than 0% and sorts to the tail. The API also exposes a precomputed `win_pct`,
 * but the standings adapter doesn't surface it, so we derive from the mapped
 * wins / losses to avoid an adapter change.
 */
function winPct(row: StandingsRow): number | null {
  const decided = row.wins + row.losses
  return decided === 0 ? null : (row.wins / decided) * 100
}

/**
 * The Win% cell: the percentage with a hover/tap breakdown of the underlying
 * W–L split. Renders a muted em-dash for rows with no decided games (matching
 * the other empty-state cells) and skips the tooltip there — there's nothing
 * to break down.
 */
function WinPctCell({ wins, losses }: { wins: number; losses: number }) {
  const decided = wins + losses
  if (decided === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const pct = (wins / decided) * 100
  return (
    <WinPctHint wins={wins} losses={losses}>
      {pct.toFixed(1)}%
    </WinPctHint>
  )
}

/**
 * The "status band": at-a-glance recency of a player's last match. Active when
 * that match landed within the last 24h, otherwise idle; a player with no
 * recorded match shows a neutral placeholder.
 */
function ActivityCell({
  lastMatchAt,
  now,
}: {
  lastMatchAt: string | null
  now: Date
}) {
  const { t } = useTranslation()
  if (!lastMatchAt) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const active =
    now.getTime() - new Date(lastMatchAt).getTime() <= ACTIVE_WITHIN_MS
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        active
          ? "bg-chart-2/10 text-chart-2-deep"
          : "bg-muted text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-chart-2" : "bg-muted-foreground/50"
        )}
      />
      {active ? t("standings.active") : t("standings.idle")}
      {/* No opacity on the time: the badge text colour already meets AA on its
          background, but opacity-70 dropped it under the 4.5:1 ratio for this
          small text (#73 / #65 audit). The dot + status word still lead the
          hierarchy. */}
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
 */
function WatchCell({
  streamUrls,
  streamLive,
}: {
  streamUrls: string[] | undefined
  streamLive: boolean
}) {
  const { t } = useTranslation()
  if (!streamUrls || streamUrls.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      {streamUrls.map((url) => {
        const platform = streamPlatform(url)
        const Icon = STREAM_ICON[platform]
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={t(`standings.watchOn.${platform}`)}
            className={cn(
              "hover:text-brand transition-colors",
              streamLive ? "text-brand" : "text-muted-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden />
          </a>
        )
      })}
      {streamLive && (
        // Pulsing dot mirrors the in-match `LiveBadge` ring above — same
        // "right now" signal vocabulary, smaller because the icons next to
        // it already carry the click affordance. `role="img"` lets the
        // wrapper carry the "Streaming live" label for assistive tech — a
        // bare <span> can't (aria-prohibited-attr, flagged in the #65 audit).
        <span
          role="img"
          className="relative inline-flex size-1.5"
          aria-label={t("standings.streamingLive")}
        >
          <span className="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-75" />
          <span className="bg-brand relative inline-flex size-1.5 rounded-full" />
        </span>
      )}
    </span>
  )
}
