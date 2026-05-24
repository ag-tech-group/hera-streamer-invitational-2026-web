import { Globe } from "lucide-react"
import { useMemo } from "react"
import type { ReactNode, Ref } from "react"

import { SortableTh } from "@/components/sortable-th"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useTableSort,
  type SortableValue,
  type SortDirection,
  type SortState,
} from "@/hooks/use-table-sort"
import { formatRelativeTime, normalizeCountryCode } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useFlipRows } from "@/pages/home/use-flip-rows"
import type { MatchResult, StandingsRow } from "@/types"

/** A player's last match counts as "active" if it landed within this window. */
const ACTIVE_WITHIN_MS = 24 * 60 * 60 * 1000

/** Placeholder row count rendered while the standings request is in flight. */
const SKELETON_ROW_COUNT = 6

/**
 * The polished standings table. A pure presentation component: it renders the
 * rows it is handed and owns no fetching or query state — `HomePage` decides
 * when a populated table is the right thing to show (vs. loading/empty/error).
 */
export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
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
      caption="Live tournament standings"
      bodyRef={containerRef}
      headerRow={<StandingsHeaderRow sortState={sortState} onSort={sortBy} />}
    >
      {sortedRows.map((row) => (
        <tr
          key={row.profileId}
          data-flip-id={row.profileId}
          ref={registerRow}
          className="hover:bg-muted/40 border-b transition-colors last:border-b-0"
        >
          <td className="px-4 py-3">
            <PositionCell position={positionMap.get(row.profileId) ?? 0} />
          </td>
          <td className="px-4 py-3">
            <RankCell rank={row.rank} />
          </td>
          <td className="px-4 py-3">
            <PlayerCell
              alias={row.alias}
              country={row.country}
              inMatch={row.inMatch}
            />
          </td>
          <td className="px-4 py-3 text-right font-medium tabular-nums">
            {row.currentRating}
          </td>
          <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
            {row.maxRating}
          </td>
          <td className="px-4 py-3 text-center">
            <StreakCell streak={row.streak} />
          </td>
          <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
            {row.gamesPlayed}
          </td>
          <td className="px-4 py-3">
            <RecentResultsCell results={row.recentResults} />
          </td>
          <td className="px-4 py-3">
            <ActivityCell lastMatchAt={row.lastMatchAt} now={now} />
          </td>
        </tr>
      ))}
    </TableShell>
  )
}

/** Maps a sort key onto the `StandingsRow` field it ranks by. */
function getSortValue(row: StandingsRow, key: string): SortableValue {
  switch (key) {
    case "rank":
      return row.rank
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
}: {
  sortState?: SortState | null
  onSort?: (key: string, defaultDirection: SortDirection) => void
}) {
  return (
    <tr className="text-muted-foreground font-display border-b text-left text-sm tracking-widest uppercase">
      <SortableTh label="Position" />
      <SortableTh
        label="Ladder"
        sortKey="rank"
        defaultDirection="asc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label="Player"
        sortKey="alias"
        defaultDirection="asc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label="Rating"
        align="right"
        sortKey="currentRating"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label="Peak"
        align="right"
        sortKey="maxRating"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label="Streak"
        align="center"
        sortKey="streak"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label="Games"
        align="right"
        sortKey="gamesPlayed"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh label="Recent" />
      <SortableTh
        label="Activity"
        sortKey="lastMatchAt"
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
 * layout shift.
 */
export function StandingsTableSkeleton() {
  return (
    <TableShell caption="Loading standings" headerRow={<StandingsHeaderRow />}>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <tr key={index} className="border-b last:border-b-0">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-5" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-5" />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-[1.333rem] rounded-[2px]" />
              <Skeleton className="h-4 w-28" />
            </div>
          </td>
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-12" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-12" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="mx-auto h-5 w-10" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-8" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-5 w-24 rounded-full" />
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
    <div className="bg-card shadow-card overflow-x-auto rounded-lg">
      <table className="w-full min-w-[800px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>{headerRow}</thead>
        <tbody ref={bodyRef}>{children}</tbody>
      </table>
    </div>
  )
}

/**
 * Tournament position — the row's 1-based place. The top three are
 * weighted; rank-1 also gets the brand accent so the leader stands out
 * at a glance.
 */
function PositionCell({ position }: { position: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        position <= 3 && "font-semibold",
        position === 1 && "text-brand"
      )}
    >
      {position}
    </span>
  )
}

/** Global ladder rank, with the top three given a touch more weight. */
function RankCell({ rank }: { rank: number | null }) {
  if (rank === null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span
      className={cn(
        "tabular-nums",
        rank <= 3 ? "font-semibold" : "text-muted-foreground"
      )}
    >
      {rank}
    </span>
  )
}

/**
 * Player identity: country flag (or a globe fallback) and alias, plus a
 * pulsing "Live" badge when the player is in a match right now.
 */
function PlayerCell({
  alias,
  country,
  inMatch,
}: {
  alias: string
  country: string | null
  inMatch: boolean
}) {
  const countryCode = normalizeCountryCode(country)
  return (
    <span className="flex items-center gap-2">
      {countryCode ? (
        <span
          className={`fi fi-${countryCode} ring-border shrink-0 rounded-[2px] text-base ring-1 ring-inset`}
          title={countryCode.toUpperCase()}
          aria-hidden
        />
      ) : (
        <Globe className="text-muted-foreground size-4 shrink-0" aria-hidden />
      )}
      <span className="font-medium whitespace-nowrap">{alias}</span>
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
  return (
    <span
      className="bg-brand/15 text-brand inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
      aria-label="In a live match"
    >
      <span className="relative flex size-1.5" aria-hidden>
        <span className="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-75" />
        <span className="bg-brand relative inline-flex size-1.5 rounded-full" />
      </span>
      Live
    </span>
  )
}

/**
 * Win/loss streak. The upstream ladder reports a signed integer: positive is a
 * run of wins, negative a run of losses, zero none.
 */
function StreakCell({ streak }: { streak: number }) {
  if (streak === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const winning = streak > 0
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        winning
          ? "bg-chart-2/10 text-chart-2"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {winning ? "W" : "L"}
      {Math.abs(streak)}
    </span>
  )
}

/**
 * Recent form: a compact row of win/loss pips, most-recent first. Greens are
 * wins and reds losses — the same colour language as the streak badge. A
 * player with no completed match shows a neutral placeholder.
 */
function RecentResultsCell({ results }: { results: MatchResult[] }) {
  if (results.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  return (
    <span
      className="flex items-center gap-1"
      aria-label={`Recent results, most recent first: ${results.join(", ")}`}
    >
      {results.map((result, index) => (
        <span
          key={index}
          aria-hidden
          title={result === "win" ? "Win" : "Loss"}
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
  if (!lastMatchAt) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const active =
    now.getTime() - new Date(lastMatchAt).getTime() <= ACTIVE_WITHIN_MS
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-chart-2/10 text-chart-2" : "bg-muted text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-chart-2" : "bg-muted-foreground/50"
        )}
      />
      {active ? "Active" : "Idle"}
      <span className="tabular-nums opacity-70">
        {formatRelativeTime(lastMatchAt, now)}
      </span>
    </span>
  )
}
