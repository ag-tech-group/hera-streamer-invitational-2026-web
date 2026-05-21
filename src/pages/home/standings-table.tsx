import { Globe } from "lucide-react"
import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { countryFlagEmoji, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { StandingsRow } from "@/types"

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

  return (
    <TableShell caption="Live tournament standings">
      {rows.map((row) => (
        <tr
          key={row.profileId}
          className="hover:bg-muted/40 border-b transition-colors last:border-b-0"
        >
          <td className="px-4 py-3">
            <RankCell rank={row.rank} />
          </td>
          <td className="px-4 py-3">
            <PlayerCell alias={row.alias} country={row.country} />
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
          <td className="px-4 py-3">
            <ActivityCell lastMatchAt={row.lastMatchAt} now={now} />
          </td>
        </tr>
      ))}
    </TableShell>
  )
}

/**
 * Loading placeholder for the standings table. Renders through the same
 * `TableShell` and column count as the real table, so data arriving causes no
 * layout shift.
 */
export function StandingsTableSkeleton() {
  return (
    <TableShell caption="Loading standings">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <tr key={index} className="border-b last:border-b-0">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-5" />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
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
            <Skeleton className="h-5 w-24 rounded-full" />
          </td>
        </tr>
      ))}
    </TableShell>
  )
}

/**
 * Shared chrome — bordered container, table element, column header — so the
 * populated table and its loading skeleton can never drift out of alignment.
 */
function TableShell({
  caption,
  children,
}: {
  caption: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
            <th className="px-4 py-3 font-medium">Rank</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 text-right font-medium">Rating</th>
            <th className="px-4 py-3 text-right font-medium">Peak</th>
            <th className="px-4 py-3 text-center font-medium">Streak</th>
            <th className="px-4 py-3 font-medium">Activity</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** Rank number, with the top three given a touch more weight. */
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

/** Player identity: country flag (or a globe fallback) plus alias. */
function PlayerCell({
  alias,
  country,
}: {
  alias: string
  country: string | null
}) {
  const flag = countryFlagEmoji(country)
  return (
    <span className="flex items-center gap-2">
      {flag ? (
        <span className="text-base leading-none" title={country ?? undefined}>
          {flag}
        </span>
      ) : (
        <Globe className="text-muted-foreground size-4" aria-hidden />
      )}
      <span className="font-medium">{alias}</span>
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
