import { ArrowDown, ArrowUp } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { useTableSort, type SortableValue } from "@/hooks/use-table-sort"
import { cn } from "@/lib/utils"
import type { CivStat, CivStats } from "@/pages/stats/civ-stats"

/** Most-played civs shown in the pick-rate leaderboard (the unsorted default). */
const TOP_PICKS = 16

/** Projects a civ onto the value for the active sort column. */
function civSortValue(c: CivStat, key: string): SortableValue {
  if (key === "name") return c.name
  if (key === "picks") return c.picks
  if (key === "winPct") return c.winPct // null (sub-threshold) sorts last
  return null
}

/**
 * Civilization meta (#302). Two readings of the same data, toggled by the sort
 * control — "have your cake and eat it too":
 *
 * - **Unsorted (default):** two side-by-side ranked leaderboards (most-picked,
 *   highest win%) — the at-a-glance meta. This is `useTableSort`'s `null` state.
 * - **Sorted (a column active):** one unified table, each civ with both bars —
 *   pick rate (blue) + win rate (green) — re-rankable by Civ (A–Z), picks, or
 *   win%. The "Both" chip (or cycling a column off) returns to the dual view.
 *
 * Plain HTML/CSS rather than echarts so each civ's colored heraldic shield
 * renders as a native `<img>`.
 */
export function CivMeta({ stats }: { stats: CivStats }) {
  const { t } = useTranslation()
  // Sort over the full picked field (byPicks carries every civ, win% included).
  const { sortedRows, sortState, sortBy, clearSort } = useTableSort(
    stats.byPicks,
    civSortValue
  )
  const maxPicks = stats.byPicks[0]?.picks ?? 1

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SortControls
          sortKey={sortState?.key ?? null}
          direction={sortState?.direction ?? null}
          onSort={sortBy}
          onClear={clearSort}
        />
        <span className="text-muted-foreground text-xs">
          {t("stats.civ.matchSample", { count: stats.matchCount })}
        </span>
      </div>

      {sortState === null ? (
        // Dual leaderboards — the showcase default.
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          <CivColumn
            title={t("stats.civ.pickRate")}
            rows={stats.byPicks.slice(0, TOP_PICKS)}
            barPct={(c) => (c.picks / maxPicks) * 100}
            value={(c) => c.picks}
          />
          <CivColumn
            title={t("stats.civ.winRate")}
            caption={t("stats.civ.minGames", { count: stats.minPicks })}
            rows={stats.byWinPct}
            barPct={(c) => c.winPct ?? 0}
            value={(c) => <WinValue c={c} />}
            emptyHint={t("stats.civ.notEnough")}
          />
        </div>
      ) : (
        // Unified table — both bars per civ, in the chosen order.
        <UnifiedTable rows={sortedRows} maxPicks={maxPicks} />
      )}
    </div>
  )
}

/** Win% + its pick count, or an em dash when below the threshold. */
function WinValue({ c }: { c: CivStat }) {
  if (c.winPct === null) return <span className="text-muted-foreground">—</span>
  return (
    <>
      {c.winPct.toFixed(0)}%{" "}
      <span className="text-muted-foreground/70 text-xs">{c.picks}</span>
    </>
  )
}

/** A single progress bar (track + brand-blue fill). */
function Bar({ pct }: { pct: number }) {
  return (
    <div className="bg-brand/10 relative h-5 flex-1 overflow-hidden rounded">
      <div
        className="bg-brand absolute inset-y-0 left-0 rounded"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

/** Civ emblem + name, the shared left cell. Keeps the slot when no shield. */
function CivLabel({ c, width }: { c: CivStat; width: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2.5", width)}>
      {c.emblemUrl ? (
        <img
          src={c.emblemUrl}
          alt=""
          loading="lazy"
          className="size-6 shrink-0"
        />
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}
      <span className="truncate text-sm" title={c.name}>
        {c.name}
      </span>
    </div>
  )
}

/** One ranked leaderboard column (unsorted default view). */
function CivColumn({
  title,
  caption,
  rows,
  barPct,
  value,
  emptyHint,
}: {
  title: string
  caption?: string
  rows: CivStat[]
  barPct: (c: CivStat) => number
  value: (c: CivStat) => ReactNode
  emptyHint?: string
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        {caption ? (
          <span className="text-muted-foreground text-xs">{caption}</span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {emptyHint}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li key={c.civId} className="flex items-center gap-2.5">
              <CivLabel c={c} width="w-32" />
              <Bar pct={barPct(c)} />
              <span className="w-14 shrink-0 text-right text-sm whitespace-nowrap tabular-nums">
                {value(c)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Unified two-bar table (a column is active). */
function UnifiedTable({
  rows,
  maxPicks,
}: {
  rows: CivStat[]
  maxPicks: number
}) {
  const { t } = useTranslation()
  return (
    <div>
      {/* Column labels — sorting is driven by the chips above, so these are
          plain headers identifying the two bars. */}
      <div className="text-muted-foreground mb-2 flex items-center gap-3 px-1 text-xs font-medium tracking-wide uppercase">
        <span className="w-32 shrink-0">{t("stats.civ.civHeader")}</span>
        <span className="flex-1">{t("stats.civ.pickRate")}</span>
        <span className="flex-1">{t("stats.civ.winRate")}</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((c) => (
          <li key={c.civId} className="flex items-center gap-3">
            <CivLabel c={c} width="w-32" />
            <div className="flex flex-1 items-center gap-2">
              <Bar pct={(c.picks / maxPicks) * 100} />
              <span className="w-8 shrink-0 text-right text-sm tabular-nums">
                {c.picks}
              </span>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <Bar pct={c.winPct ?? 0} />
              <span className="w-14 shrink-0 text-right text-sm whitespace-nowrap tabular-nums">
                <WinValue c={c} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The sort toggle: Both (dual view) · A–Z · Pick rate · Win rate. */
function SortControls({
  sortKey,
  direction,
  onSort,
  onClear,
}: {
  sortKey: string | null
  direction: "asc" | "desc" | null
  onSort: (key: string, defaultDirection: "asc" | "desc") => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground mr-0.5 text-xs">
        {t("stats.civ.sortLabel")}
      </span>
      <Chip active={sortKey === null} onClick={onClear}>
        {t("stats.civ.sortBoth")}
      </Chip>
      <Chip
        active={sortKey === "name"}
        direction={sortKey === "name" ? direction : null}
        onClick={() => onSort("name", "asc")}
      >
        {t("stats.civ.sortName")}
      </Chip>
      <Chip
        active={sortKey === "picks"}
        direction={sortKey === "picks" ? direction : null}
        onClick={() => onSort("picks", "desc")}
      >
        {t("stats.civ.pickRate")}
      </Chip>
      <Chip
        active={sortKey === "winPct"}
        direction={sortKey === "winPct" ? direction : null}
        onClick={() => onSort("winPct", "desc")}
      >
        {t("stats.civ.winRate")}
      </Chip>
    </div>
  )
}

function Chip({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean
  direction?: "asc" | "desc" | null
  onClick: () => void
  children: ReactNode
}) {
  const Arrow =
    direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-brand/30 bg-brand/10 text-brand"
          : "border-border text-muted-foreground hover:bg-muted/60"
      )}
    >
      {children}
      {Arrow ? <Arrow className="size-3" aria-hidden /> : null}
    </button>
  )
}
