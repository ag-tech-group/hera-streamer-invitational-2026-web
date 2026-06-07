import { useMemo, useRef } from "react"
import type { ReactNode, Ref } from "react"
import { useTranslation } from "react-i18next"

import { SortableTh } from "@/components/sortable-th"
import { Skeleton } from "@/components/ui/skeleton"
import { useFlashOnChange } from "@/hooks/use-flash-on-change"
import { useInView } from "@/hooks/use-in-view"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  useTableSort,
  type SortableValue,
  type SortDirection,
  type SortState,
} from "@/hooks/use-table-sort"
import { teamColorMap } from "@/lib/team-colors"
import { cn } from "@/lib/utils"
import {
  CountUp,
  LastMatchCell,
  PlayerCell,
  PositionCell,
  RecentMatchupsCell,
  StreakCell,
  TeamCell,
  WatchCell,
  WinPctCell,
} from "@/pages/home/standings-cells"
import { rowKey } from "@/pages/home/standings-columns"
import {
  StandingsMobileList,
  StandingsMobileSkeleton,
} from "@/pages/home/standings-mobile-list"
import { StandingsSortBar } from "@/pages/home/standings-sort-bar"
import { useFlipRows } from "@/pages/home/use-flip-rows"
import type { StandingsRow } from "@/types"

/**
 * Below this width the desktop table (`min-w-[800px]`) can't fit inside the
 * layout's `p-8` gutters (2×32px) without horizontal scroll — even allowing
 * for a desktop vertical scrollbar — so the standings switch to the mobile
 * list + bottom sort bar. Expressed in px (not a Tailwind `sm`/`md` token)
 * because it's derived from the table's fixed min-width plus the shell
 * padding, not the design's breakpoint scale. The switch is made in JS rather
 * than CSS `hidden` so only one row tree mounts — the FLIP animation keys rows
 * by `data-flip-id`, and two mounted trees would collide those keys and put
 * duplicate rows in the accessibility tree.
 */
const MOBILE_MEDIA_QUERY = "(max-width: 879px)"

/** Placeholder row count rendered while the standings request is in flight. */
const SKELETON_ROW_COUNT = 6

/**
 * The polished standings table. A pure presentation component: it renders the
 * rows it is handed and owns no fetching or query state — `HomePage` decides
 * when a populated table is the right thing to show (vs. loading/empty/error).
 *
 * Above `MOBILE_MEDIA_QUERY` it renders the full desktop `<table>`; below it,
 * the slim mobile list + a fixed bottom sort bar. Both views read the *same*
 * `useTableSort` state, so the sort never forks between them.
 *
 * Every column renders at all times. (Games + Recent were previously hidden
 * until the tournament's start date passed; that gate was removed so the full
 * table shows from the start — pre-start those cells just read as 0 / empty.)
 */
export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY)
  // One reference instant for the whole render, so every "time ago" in the
  // Activity column is measured against the same clock.
  const now = new Date()

  // Tournament position ranks by peak (max) rating (#197), so re-rank the
  // incoming rows here rather than trusting the API's order — this drives both
  // the default view order and the Position column. `rows` stays the source of
  // truth; `rankedRows` is a stable, derived ordering.
  const rankedRows = useMemo(() => [...rows].sort(comparePeakRank), [rows])

  const { sortedRows, sortState, sortBy, setSort } = useTableSort(
    rankedRows,
    getSortValue
  )

  // FLIP animation: rows slide to their new spots whenever the order
  // changes (either from a live SSE refresh or a header click). Keyed off
  // the same `rowKey` (tournamentPlayerId) the `<tr>` uses, so the slide
  // tracking and the rows agree on each row's identity. Desktop-only — the
  // mobile list has variable-height (expandable) rows, so it just reflows.
  const orderKey = sortedRows.map(rowKey).join(",")
  const { containerRef, registerRow } = useFlipRows(orderKey)

  // The Position column shows the row's tournament rank — its place in the
  // peak-rating order (`rankedRows`), not the current sorted view. Without
  // this, sorting by another column would relabel "Position 1" as the top of
  // that sort instead of the tournament leader. Keyed by `rowKey`
  // (tournamentPlayerId) so every row gets its own position entry.
  const positionMap = useMemo(() => {
    const map = new Map<string, number>()
    rankedRows.forEach((row, i) => map.set(rowKey(row), i + 1))
    return map
  }, [rankedRows])

  // Team → colour by creation order (#231), built from every team id present
  // in the standings so the chip here paints the same colour as the team's
  // panel on the Teams tab and its bar on the stats page. Keyed by id, so it's
  // independent of this table's row order.
  const colorByTeamId = useMemo(
    () =>
      teamColorMap(rows.flatMap((row) => (row.team ? [row.team.teamId] : []))),
    [rows]
  )

  // The fixed sort bar shows only while the list is on screen; once you scroll
  // past it to the footer the bar slides away so it never covers the footer.
  const listRef = useRef<HTMLDivElement>(null)
  const listInView = useInView(listRef)

  if (isMobile) {
    return (
      <>
        <div ref={listRef}>
          <StandingsMobileList
            rows={sortedRows}
            sortState={sortState}
            positionMap={positionMap}
            colorByTeamId={colorByTeamId}
            now={now}
          />
        </div>
        <StandingsSortBar
          sortState={sortState}
          setSort={setSort}
          visible={listInView}
        />
      </>
    )
  }

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
              row.team ? colorByTeamId.get(row.team.teamId) : undefined
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
              <TeamCell
                team={row.team}
                colorSlot={
                  row.team ? colorByTeamId.get(row.team.teamId) : undefined
                }
              />
            </td>
            <td className="px-4 py-3">
              <PlayerCell
                profileId={row.profileId}
                name={row.name}
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
              className="font-display px-4 py-3 text-end text-lg tracking-wide tabular-nums"
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
              className="text-muted-foreground px-4 py-3 text-end tabular-nums"
            >
              {row.currentRating === null ? (
                <span className="text-muted-foreground text-xs">—</span>
              ) : (
                row.currentRating
              )}
            </FlashCell>
            <FlashCell
              value={row.gamesPlayed}
              className="text-muted-foreground px-4 py-3 text-end tabular-nums"
            >
              {row.gamesPlayed}
            </FlashCell>
            {/* Win% sits right after Games. Tooltip breaks down the W–L
                split behind the percentage (hover desktop / tap mobile). */}
            <FlashCell
              value={row.winPct}
              className="px-4 py-3 text-end tabular-nums"
            >
              <WinPctCell
                winPct={row.winPct}
                wins={row.wins}
                losses={row.losses}
              />
            </FlashCell>
            {/* Streak sits just left of Recent — both are "recent form". */}
            <FlashCell value={row.streak} className="px-4 py-3 text-center">
              <StreakCell streak={row.streak} />
            </FlashCell>
            <td className="px-4 py-3">
              <RecentMatchupsCell
                matchups={row.recentMatchups}
                playerName={row.presentation.displayName ?? row.name}
                now={now}
              />
            </td>
            <td className="px-4 py-3">
              <LastMatchCell lastMatchAt={row.lastMatchAt} now={now} />
            </td>
            <td className="px-4 py-3 text-center">
              <WatchCell
                streamUrls={row.presentation.streamUrls}
                streamLive={row.streamLive}
                streamTitle={row.streamTitle}
                streamCategory={row.streamCategory}
                profileId={row.profileId}
                alias={row.alias}
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

/** Maps a sort key onto the `StandingsRow` field it ranks by. */
function getSortValue(row: StandingsRow, key: string): SortableValue {
  switch (key) {
    case "team":
      // Sort groups players by team (by initials); the un-teamed sort last.
      return row.team?.initials ?? null
    case "alias":
      // Sort by the visible label (override else the unified `name`, #187) so
      // the Player column orders by what's actually shown, not the raw alias.
      return row.presentation.displayName ?? row.name
    case "currentRating":
      return row.currentRating
    case "maxRating":
      return row.maxRating
    case "streak":
      return row.streak
    case "gamesPlayed":
      return row.gamesPlayed
    case "winPct":
      // API-computed tournament-window win% (#238); null (no in-window decided
      // games) sorts last rather than as 0% so a 0-game row can't outrank a
      // real record.
      return row.winPct
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
 * hook's null handling; ties break on current rating, then name, so a shared
 * peak still orders by who's higher right now and the result is deterministic.
 */
function comparePeakRank(a: StandingsRow, b: StandingsRow): number {
  return (
    descNullsLast(a.maxRating, b.maxRating) ||
    descNullsLast(a.currentRating, b.currentRating) ||
    // Null-safe: a sort comparator must never throw — one bad row would crash
    // the whole table sort. The adapter already coerces `name` to a string
    // (#313); this guards any future non-adapter row source.
    (a.name ?? "").localeCompare(b.name ?? "")
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
    <tr className="text-muted-foreground font-display border-b text-start text-sm tracking-widest uppercase">
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
      <SortableTh
        label={t("standings.headers.streak")}
        align="center"
        sortKey="streak"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh label={t("standings.headers.recent")} />
      <SortableTh
        label={t("standings.headers.lastMatch")}
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
 * layout shift. Below `MOBILE_MEDIA_QUERY` it swaps to the mobile skeleton so
 * the loading state never horizontal-scrolls an 800px table either.
 */
export function StandingsTableSkeleton() {
  const { t } = useTranslation()
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY)
  if (isMobile) {
    return <StandingsMobileSkeleton />
  }
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
            <Skeleton className="ms-auto h-6 w-14" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="ms-auto h-4 w-12" />
          </td>
          {/* Games placeholder */}
          <td className="px-4 py-3">
            <Skeleton className="ms-auto h-4 w-8" />
          </td>
          {/* Win% placeholder */}
          <td className="px-4 py-3">
            <Skeleton className="ms-auto h-4 w-12" />
          </td>
          {/* Streak placeholder — sits just left of Recent, matching the
              populated row order. */}
          <td className="px-4 py-3">
            <Skeleton className="mx-auto h-5 w-10" />
          </td>
          {/* Recent placeholder */}
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-20" />
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
        className="pointer-events-none absolute -end-24 -top-24 size-64 rounded-full opacity-80 blur-3xl"
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
