import { useMemo } from "react"
import type { ReactNode, Ref } from "react"
import { useTranslation } from "react-i18next"

import { SortableTh } from "@/components/sortable-th"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useTableSort,
  type SortableValue,
  type SortDirection,
  type SortState,
} from "@/hooks/use-table-sort"
import { cn } from "@/lib/utils"
import { useFlipRows } from "@/pages/home/use-flip-rows"
import type { TeamMember, TeamStandingsRow } from "@/types"

/** Placeholder row count rendered while the team standings request is in flight. */
const SKELETON_ROW_COUNT = 4

/**
 * The team standings table — the team-scoped counterpart of `StandingsTable`.
 * Teams are ranked by combined rating (the sum of their members' current
 * ratings); each row carries the team identity and its full roster.
 */
export function TeamsTable({ rows }: { rows: TeamStandingsRow[] }) {
  const { t } = useTranslation()
  const { sortedRows, sortState, sortBy } = useTableSort(rows, getSortValue)

  // FLIP animation: rows slide to their new spots when the ranked order
  // changes, matching the players table.
  const orderKey = sortedRows.map((row) => row.teamId).join(",")
  const { containerRef, registerRow } = useFlipRows(orderKey)

  // Position reflects the canonical (unsorted) standings — same pattern
  // as the players table; sorting by another column shouldn't relabel
  // the leaderboard rank.
  const positionMap = useMemo(() => {
    const map = new Map<number, number>()
    rows.forEach((row, i) => map.set(row.teamId, i + 1))
    return map
  }, [rows])

  return (
    <TeamsTableShell
      caption={t("teams.caption")}
      bodyRef={containerRef}
      headerRow={<TeamsHeaderRow sortState={sortState} onSort={sortBy} />}
    >
      {sortedRows.map((row) => (
        <tr
          key={row.teamId}
          data-flip-id={row.teamId}
          ref={registerRow}
          className="hover:bg-muted/40 border-b transition-colors last:border-b-0"
        >
          <td className="px-4 py-3">
            <PositionCell position={positionMap.get(row.teamId) ?? 0} />
          </td>
          <td className="px-4 py-3">
            <TeamCell initials={row.initials} name={row.name} />
          </td>
          <td className="px-4 py-3 text-right font-medium tabular-nums">
            {row.combinedRatingSum}
          </td>
          <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
            {Math.round(row.combinedRatingAverage)}
          </td>
          <td className="px-4 py-3">
            <RosterCell members={row.members} />
          </td>
        </tr>
      ))}
    </TeamsTableShell>
  )
}

/** Maps a sort key onto the `TeamStandingsRow` field it ranks by. */
function getSortValue(row: TeamStandingsRow, key: string): SortableValue {
  switch (key) {
    case "name":
      return row.name
    case "combinedRatingSum":
      return row.combinedRatingSum
    case "combinedRatingAverage":
      return row.combinedRatingAverage
    default:
      return null
  }
}

/**
 * Header row for the team standings, shared between the populated table
 * (passes sort state + handler) and the loading skeleton (omits both).
 */
function TeamsHeaderRow({
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
        label={t("teams.headers.team")}
        sortKey="name"
        defaultDirection="asc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("teams.headers.combined")}
        align="right"
        sortKey="combinedRatingSum"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh
        label={t("teams.headers.average")}
        align="right"
        sortKey="combinedRatingAverage"
        defaultDirection="desc"
        sortState={sortState}
        onSort={onSort}
      />
      <SortableTh label={t("teams.headers.members")} />
    </tr>
  )
}

/**
 * Loading placeholder for the team standings table. Renders through the same
 * `TeamsTableShell` and column count as the real table, so data arriving
 * causes no layout shift.
 */
export function TeamsTableSkeleton() {
  const { t } = useTranslation()
  return (
    <TeamsTableShell
      caption={t("teams.captionLoading")}
      headerRow={<TeamsHeaderRow />}
    >
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <tr key={index} className="border-b last:border-b-0">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-5" />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-10 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
          </td>
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-14" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="ml-auto h-4 w-12" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-48" />
          </td>
        </tr>
      ))}
    </TeamsTableShell>
  )
}

/**
 * Shared chrome — bordered container, table element — so the populated
 * team table and its loading skeleton stay aligned. The header row is
 * passed in so each caller wires sort state where appropriate.
 */
function TeamsTableShell({
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
    <div className="bg-card shadow-card overflow-x-auto overflow-y-hidden rounded-lg">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>{headerRow}</thead>
        <tbody ref={bodyRef}>{children}</tbody>
      </table>
    </div>
  )
}

/**
 * Team standings position — the row's 1-based place. Top three are
 * weighted; rank-1 also gets the brand accent, matching the player
 * standings treatment.
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

/** Team identity: an initials chip (a team's stand-in for a flag) and name. */
function TeamCell({ initials, name }: { initials: string; name: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="bg-muted text-muted-foreground inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold tracking-wide">
        {initials}
      </span>
      <span className="font-medium whitespace-nowrap">{name}</span>
    </span>
  )
}

/**
 * The team's roster — each member with their current rating, so the combined
 * rating reads as the sum of its parts. A team with no rated members shows a
 * neutral placeholder.
 */
function RosterCell({ members }: { members: TeamMember[] }) {
  if (members.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  return (
    <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {members.map((member) => (
        <span key={member.profileId} className="whitespace-nowrap">
          {member.alias}{" "}
          <span className="tabular-nums opacity-70">
            {member.currentRating}
          </span>
        </span>
      ))}
    </span>
  )
}
