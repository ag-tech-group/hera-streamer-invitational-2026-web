import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react"

import type { SortDirection, SortState } from "@/hooks/use-table-sort"
import { cn } from "@/lib/utils"

/**
 * Table header cell, optionally sortable.
 *
 * When `sortKey` and `onSort` are both provided, the header becomes an
 * interactive button that cycles its column through the sort states managed
 * by `useTableSort`. Otherwise it renders as a plain `<th>` — which is what
 * the loading-state skeletons want, since clicking sort on a placeholder
 * has no meaningful effect.
 *
 * The active-sort glyph (`ChevronUp`/`ChevronDown`) renders in the brand
 * accent so the active column reads at a glance; the unsorted glyph
 * (`ChevronsUpDown`) sits in the muted foreground to advertise the
 * affordance without competing with the active marker. The icon always
 * sits *after* the label regardless of cell alignment — readers expect
 * sort glyphs to trail the column name, and flipping it for right-aligned
 * columns just reads inconsistently.
 */
type Align = "left" | "center" | "right"

const TH_ALIGN: Record<Align, string> = {
  left: "text-start",
  center: "text-center",
  right: "text-end",
}

const BUTTON_JUSTIFY: Record<Align, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
}

export function SortableTh({
  label,
  align = "left",
  sortKey,
  defaultDirection = "asc",
  sortState,
  onSort,
  className,
}: {
  label: string
  align?: Align
  sortKey?: string
  defaultDirection?: SortDirection
  sortState?: SortState | null
  onSort?: (key: string, defaultDirection: SortDirection) => void
  /**
   * Overrides the default `px-4 py-3` cell chrome — a compact table (e.g. the
   * head-to-head feed) passes its own padding plus any sticky/background, while
   * the standings header keeps the default by omitting it.
   */
  className?: string
}) {
  const cellClassName = cn(className ?? "px-4 py-3", TH_ALIGN[align])
  // Plain header: skeleton case, or columns explicitly not sortable.
  if (!sortKey || !onSort) {
    return <th className={cellClassName}>{label}</th>
  }

  const active = sortState?.key === sortKey
  const direction = active ? sortState?.direction : null
  const Icon =
    direction === "asc"
      ? ChevronUp
      : direction === "desc"
        ? ChevronDown
        : ChevronsUpDown
  const ariaSort =
    direction === "asc"
      ? "ascending"
      : direction === "desc"
        ? "descending"
        : "none"

  return (
    <th className={cellClassName} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey, defaultDirection)}
        // `py-1.5` lifts the button's hit area toward the 44px touch-target
        // guideline (#214); `-my-1.5` keeps the header row height unchanged.
        className={cn(
          "hover:text-foreground -my-1.5 inline-flex w-full items-center gap-1 py-1.5 transition-colors",
          BUTTON_JUSTIFY[align],
          active && "text-foreground"
        )}
      >
        <span>{label}</span>
        <Icon
          className={cn("size-3", active ? "text-brand" : "opacity-60")}
          aria-hidden
        />
      </button>
    </th>
  )
}
