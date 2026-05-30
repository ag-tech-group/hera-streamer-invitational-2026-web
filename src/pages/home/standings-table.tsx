import { ExternalLink, Globe, Twitch, Youtube } from "lucide-react"
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
  aoe2insightsPlayerUrl,
  formatRelativeTime,
  normalizeCountryCode,
} from "@/lib/format"
import { teamColorSlot } from "@/lib/team-colors"
import { cn } from "@/lib/utils"
import { useFlipRows } from "@/pages/home/use-flip-rows"
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
 * The polished standings table. A pure presentation component: it renders the
 * rows it is handed and owns no fetching or query state — `HomePage` decides
 * when a populated table is the right thing to show (vs. loading/empty/error).
 *
 * `tournamentStarted` gates the Games + Recent columns: before the tournament
 * begins, those columns are always zero / empty (the API scopes both to the
 * tournament's date window), so they read as dead chrome. `HomePage` derives
 * the flag from `tournament.startDate`; the column treatment is reversible
 * the moment the start date passes.
 */
export function StandingsTable({
  rows,
  tournamentStarted,
}: {
  rows: StandingsRow[]
  tournamentStarted: boolean
}) {
  const { t } = useTranslation()
  // One reference instant for the whole render, so every "time ago" in the
  // Activity column is measured against the same clock.
  const now = new Date()

  const { sortedRows, sortState, sortBy } = useTableSort(rows, getSortValue)

  // FLIP animation: rows slide to their new spots whenever the order
  // changes (either from a live SSE refresh or a header click).
  const orderKey = sortedRows.map((row) => row.profileId).join(",")
  const { containerRef, registerRow } = useFlipRows(orderKey)

  // The Position column shows the row's tournament rank, which is the
  // index in the *original* (unsorted) row list — not the current sorted
  // view. Without this, sorting by another column would relabel "Position 1"
  // as the top of that sort instead of the tournament leader.
  const positionMap = useMemo(() => {
    const map = new Map<number, number>()
    rows.forEach((row, i) => map.set(row.profileId, i + 1))
    return map
  }, [rows])

  return (
    <TableShell
      caption={t("standings.caption")}
      bodyRef={containerRef}
      headerRow={
        <StandingsHeaderRow
          sortState={sortState}
          onSort={sortBy}
          tournamentStarted={tournamentStarted}
        />
      }
    >
      {sortedRows.map((row) => {
        const position = positionMap.get(row.profileId) ?? 0
        const isLeader = position === 1
        return (
          <tr
            key={row.profileId}
            data-flip-id={row.profileId}
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
                inMatch={row.inMatch}
              />
            </td>
            {/*
             * Rating is the most-watched number on the page, so it takes
             * the same Bebas Neue + size-bump treatment the team-panel
             * combined-rating got in #119. Drops `font-medium` because
             * the display face ships at weight 400 only; bumps to text-lg
             * + tracking-wide so the condensed glyphs read at the same
             * visual weight as the surrounding sans data — the rest of
             * the row stays at text-sm so the rating still wins
             * hierarchy.
             */}
            <FlashCell
              value={row.currentRating}
              className="font-display px-4 py-3 text-right text-lg tracking-wide tabular-nums"
            >
              {/*
               * Null currentRating = unrated roster member (left-joined onto
               * the standings; the API sorts these to the tail). Render the
               * same muted em-dash the streak / recent / activity cells use
               * for their empty state rather than a count-up of nothing.
               */}
              {row.currentRating === null ? (
                <span className="text-muted-foreground text-xs">—</span>
              ) : (
                <CountUp value={row.currentRating} />
              )}
            </FlashCell>
            <FlashCell
              value={row.maxRating}
              className="text-muted-foreground px-4 py-3 text-right tabular-nums"
            >
              {row.maxRating === null ? (
                <span className="text-muted-foreground text-xs">—</span>
              ) : (
                row.maxRating
              )}
            </FlashCell>
            <FlashCell value={row.streak} className="px-4 py-3 text-center">
              <StreakCell streak={row.streak} />
            </FlashCell>
            {tournamentStarted && (
              <>
                <FlashCell
                  value={row.gamesPlayed}
                  className="text-muted-foreground px-4 py-3 text-right tabular-nums"
                >
                  {row.gamesPlayed}
                </FlashCell>
                <td className="px-4 py-3">
                  <RecentResultsCell results={row.recentResults} />
                </td>
              </>
            )}
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
    case "lastMatchAt":
      return row.lastMatchAt
    default:
      return null
  }
}

/**
 * Header row for the players standings, shared between the populated
 * table (passes sort state + handler) and the loading skeleton (omits
 * both, so `SortableTh` renders plain headers).
 */
function StandingsHeaderRow({
  sortState,
  onSort,
  tournamentStarted,
}: {
  sortState?: SortState | null
  onSort?: (key: string, defaultDirection: SortDirection) => void
  tournamentStarted: boolean
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
        label={t("standings.headers.rating")}
        align="right"
        sortKey="currentRating"
        defaultDirection="desc"
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
        label={t("standings.headers.streak")}
        align="center"
        sortKey="streak"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      {tournamentStarted && (
        <>
          <SortableTh
            label={t("standings.headers.games")}
            align="right"
            sortKey="gamesPlayed"
            defaultDirection="desc"
            sortState={sortState}
            onSort={onSort}
          />
          <SortableTh label={t("standings.headers.recent")} />
        </>
      )}
      <SortableTh
        label={t("standings.headers.activity")}
        sortKey="lastMatchAt"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh label={t("standings.headers.watch")} align="center" />
    </tr>
  )
}

/**
 * Loading placeholder for the standings table. Renders through the same
 * `TableShell` and column count as the real table, so data arriving causes no
 * layout shift. Takes the same `tournamentStarted` gate as the real table so
 * the skeleton's column count matches what's about to appear.
 */
export function StandingsTableSkeleton({
  tournamentStarted,
}: {
  tournamentStarted: boolean
}) {
  const { t } = useTranslation()
  return (
    <TableShell
      caption={t("standings.captionLoading")}
      headerRow={<StandingsHeaderRow tournamentStarted={tournamentStarted} />}
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
           * Rating placeholder is taller (h-6) than peak (h-4) because the
           * rendered rating now uses the display face at text-lg — keeping
           * the skeleton at h-4 would shift the row taller on data arrival.
           */}
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-6 w-14" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-12" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="mx-auto h-5 w-10" />
          </td>
          {tournamentStarted && (
            <>
              <td className="px-4 py-3">
                <Skeleton className="ml-auto h-4 w-8" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-20" />
              </td>
            </>
          )}
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
  inMatch,
}: {
  alias: string
  displayName?: string
  country: string | null
  flagOverride?: string
  inMatch: boolean
}) {
  const { t } = useTranslation()
  const countryCode = normalizeCountryCode(country)
  const visibleName = displayName ?? alias
  return (
    <span className="flex items-center gap-2">
      {flagOverride ? (
        <span
          className="shrink-0 text-base leading-none"
          aria-label={visibleName}
        >
          {flagOverride}
        </span>
      ) : countryCode ? (
        <span
          className={`fi fi-${countryCode} ring-border shrink-0 rounded-[2px] text-base ring-1 ring-inset`}
          title={countryCode.toUpperCase()}
          aria-hidden
        />
      ) : (
        <Globe className="text-muted-foreground size-4 shrink-0" aria-hidden />
      )}
      <a
        href={aoe2insightsPlayerUrl(alias)}
        target="_blank"
        rel="noopener noreferrer"
        title={t("standings.viewOnAoe2insights", { alias })}
        className="text-brand font-medium whitespace-nowrap underline-offset-2 transition-colors hover:underline"
      >
        {visibleName}
      </a>
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
function RecentResultsCell({ results }: { results: MatchResult[] }) {
  const { t } = useTranslation()
  if (results.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const labeled = results
    .map((r) => (r === "win" ? t("standings.win") : t("standings.loss")))
    .join(", ")
  return (
    <span
      className="flex items-center gap-1"
      aria-label={t("standings.recentAriaLabel", { results: labeled })}
    >
      {results.map((result, index) => (
        <span
          key={index}
          aria-hidden
          title={result === "win" ? t("standings.win") : t("standings.loss")}
          className={cn(
            "size-2 rounded-[2px]",
            result === "win" ? "bg-chart-2" : "bg-destructive"
          )}
        />
      ))}
    </span>
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
      <span className="tabular-nums opacity-70">
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
        // it already carry the click affordance.
        <span
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
