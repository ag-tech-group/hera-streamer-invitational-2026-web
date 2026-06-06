import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Collapsible } from "radix-ui"

import { Skeleton } from "@/components/ui/skeleton"
import type { SortState } from "@/hooks/use-table-sort"
import type { TeamColorSlot } from "@/lib/team-colors"
import { cn } from "@/lib/utils"
import { LiveDot, PlayerFlag, PositionCell } from "@/pages/home/standings-cells"
import {
  DETAIL_ITEMS,
  metricForSort,
  rowKey,
  type CellContext,
  type MetricColumn,
} from "@/pages/home/standings-columns"
import { isOffGameStream } from "@/pages/home/standings-stream"
import type { StandingsRow } from "@/types"

/** Placeholder row count rendered while the standings request is in flight. */
const SKELETON_ROW_COUNT = 8

/**
 * Mobile standings: a vertical list of slim, tap-to-expand rows shown below
 * `MOBILE_MEDIA_QUERY` in place of the desktop table — so the standings never
 * scroll sideways on a phone. Each collapsed row carries exactly three things
 * (rank, name, and the value of whatever the list is sorted by); tapping opens
 * a panel with the full stat set. The sort itself is driven by the fixed bottom
 * bar (`StandingsSortBar`); both share the one `useTableSort` state in
 * `StandingsTable`, so the metric column here always reflects the active sort.
 */
export function StandingsMobileList({
  rows,
  sortState,
  positionMap,
  colorByTeamId,
  now,
}: {
  /** Already sorted by the shared `useTableSort` state. */
  rows: StandingsRow[]
  sortState: SortState | null
  /** rowKey → tournament rank (peak-order), stable across re-sorts. */
  positionMap: Map<string, number>
  colorByTeamId: Map<number, TeamColorSlot>
  now: Date
}) {
  // The collapsed row's trailing value tracks the active sort: sort by win
  // rate and it shows win rate, etc. Defaults to Peak (what the list ranks on)
  // when nothing is actively sorted. Resolved once for the whole list.
  const metric = metricForSort(sortState)
  const ctx: CellContext = { now, colorByTeamId }
  return (
    <MobileCard>
      <ul role="list" className="divide-border divide-y">
        {rows.map((row) => (
          <StandingsMobileRow
            key={rowKey(row)}
            row={row}
            position={positionMap.get(rowKey(row)) ?? 0}
            metric={metric}
            ctx={ctx}
          />
        ))}
      </ul>
    </MobileCard>
  )
}

/** One expandable player row. */
function StandingsMobileRow({
  row,
  position,
  metric,
  ctx,
}: {
  row: StandingsRow
  position: number
  metric: MetricColumn
  ctx: CellContext
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const colorSlot = row.team
    ? ctx.colorByTeamId.get(row.team.teamId)
    : undefined
  const visibleName = row.presentation.displayName ?? row.name
  const isLeader = position === 1

  return (
    <li
      // Carry the team's colour slot so the leading accent bar paints the same
      // colour the team's chip and Teams-tab panel use (#231); the generic
      // `[data-team-color]` rule in index.css aliases the --team-color-* vars.
      data-team-color={colorSlot}
      className={cn("relative", isLeader && "bg-brand/5")}
    >
      {row.team ? (
        <span
          aria-hidden
          className="absolute inset-y-0 start-0 w-[3px]"
          style={{ background: "var(--team-color-strong)" }}
        />
      ) : null}
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="hover:bg-brand/6 active:bg-brand/10 focus-visible:ring-brand flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            {/* Rank — fixed narrow column, the tournament place (peak order). */}
            <span className="flex w-7 shrink-0 justify-center">
              <PositionCell position={position} />
            </span>
            {/* Name — flexes to fill, truncates; tiny live dot when in a match. */}
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <PlayerFlag
                country={row.country}
                flagOverride={row.presentation.flag}
                name={visibleName}
              />
              <span className="truncate font-medium">{visibleName}</span>
              {/*
               * Permanent live suffix: a pulsing dot when the player is
               * streaming (or in a match), colour-matched to the Watch tier —
               * brand for AoE2 / unknown / in-match, white for a confirmed
               * off-game stream — so it reads the same as the Watch cell. This
               * is why the dot was dropped from the compact Watch metric.
               */}
              {row.streamLive || row.inMatch ? (
                <span
                  role="img"
                  aria-label={
                    row.streamLive
                      ? row.streamCategory
                        ? t("standings.streamingCategory", {
                            category: row.streamCategory,
                          })
                        : t("standings.streamingLive")
                      : t("standings.liveAriaLabel")
                  }
                  className="shrink-0"
                >
                  <LiveDot
                    tone={
                      isOffGameStream(row.streamLive, row.streamCategory)
                        ? "foreground"
                        : "brand"
                    }
                  />
                </span>
              ) : null}
            </span>
            {/* Sorted metric — label + value, right-aligned; swaps with sort. */}
            <span className="flex shrink-0 flex-col items-end leading-tight">
              <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                {t(metric.headerKey)}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {metric.render(row, ctx)}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180"
              )}
            />
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content className="standings-collapsible-content overflow-hidden">
          <div className="px-3 pb-3">
            {/*
             * Full stat sheet — the desktop column set minus the rank. Scalar
             * stats lay out two-up to save vertical space; the wide rows (the
             * identity block, recent-form pips, stream links) span both
             * columns. The full set always shows (including the active metric)
             * so the panel layout stays predictable as the sort changes. The
             * interactive cells (clickable name → profile, win% breakdown,
             * tappable stream links) live here — the collapsed row is itself
             * one big expand button and so can hold no links.
             */}
            <dl className="border-border grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
              {DETAIL_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    "flex min-w-0 flex-col gap-0.5",
                    item.wide && "col-span-2"
                  )}
                >
                  <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    {t(item.headerKey)}
                  </dt>
                  <dd className="text-sm">{item.render(row, ctx)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </li>
  )
}

/**
 * Card chrome shared by the mobile list and its skeleton — the same elevated
 * surface + brand top-accent the desktop `TableShell` uses, so the two layouts
 * read as the same component at different widths.
 */
function MobileCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card shadow-card relative overflow-hidden rounded-lg">
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      {children}
    </div>
  )
}

/**
 * Loading placeholder for the mobile list — slim rows matching the collapsed
 * row footprint, so data arrival doesn't shift the layout. Mirrors
 * `StandingsTableSkeleton` for the narrow breakpoint.
 */
export function StandingsMobileSkeleton() {
  return (
    <MobileCard>
      <ul role="list" className="divide-border divide-y">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <li
            key={index}
            className="flex min-h-11 items-center gap-3 px-3 py-2.5"
          >
            {/* Rank chip */}
            <Skeleton className="h-5 w-7 shrink-0 rounded-md" />
            {/* Flag + name */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Skeleton className="h-4 w-[1.333rem] shrink-0 rounded-[2px]" />
              <Skeleton className="h-4 w-28" />
            </div>
            {/* Metric value */}
            <Skeleton className="h-5 w-10 shrink-0" />
            {/* Chevron */}
            <Skeleton className="size-4 shrink-0 rounded-sm" />
          </li>
        ))}
      </ul>
    </MobileCard>
  )
}
