import type { ReactNode, Ref } from "react"

import { Skeleton } from "@/components/ui/skeleton"
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
  // FLIP animation: rows slide to their new spots when the ranked order
  // changes, matching the players table.
  const orderKey = rows.map((row) => row.teamId).join(",")
  const { containerRef, registerRow } = useFlipRows(orderKey)

  return (
    <TeamsTableShell caption="Tournament team standings" bodyRef={containerRef}>
      {rows.map((row, index) => (
        <tr
          key={row.teamId}
          data-flip-id={row.teamId}
          ref={registerRow}
          className="hover:bg-muted/40 border-b transition-colors last:border-b-0"
        >
          <td className="px-4 py-3">
            <PositionCell position={index + 1} />
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

/**
 * Loading placeholder for the team standings table. Renders through the same
 * `TeamsTableShell` and column count as the real table, so data arriving
 * causes no layout shift.
 */
export function TeamsTableSkeleton() {
  return (
    <TeamsTableShell caption="Loading team standings">
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
 * Shared chrome — bordered container, table element, column header — so the
 * populated team table and its loading skeleton stay aligned.
 */
function TeamsTableShell({
  caption,
  bodyRef,
  children,
}: {
  caption: string
  bodyRef?: Ref<HTMLTableSectionElement>
  children: ReactNode
}) {
  return (
    <div className="bg-card shadow-card overflow-x-auto rounded-lg">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          {/*
           * Header row uses the display face (#38) for a broadcast caps
           * treatment; `font-medium` is dropped from the cells because
           * Bebas Neue ships only weight 400 and synthesising 500 would
           * smear the glyphs.
           */}
          <tr className="text-muted-foreground font-display border-b text-left text-sm tracking-widest uppercase">
            <th className="px-4 py-3">Position</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3 text-right">Combined</th>
            <th className="px-4 py-3 text-right">Avg</th>
            <th className="px-4 py-3">Members</th>
          </tr>
        </thead>
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
