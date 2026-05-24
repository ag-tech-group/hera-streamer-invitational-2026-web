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
 * affordance without competing with the active marker. For right-aligned
 * columns the icon flips to the *left* of the label so the column's
 * numeric content stays flush to the right margin.
 */
type Align = "left" | "center" | "right"

const TH_ALIGN: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
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
}: {
  label: string
  align?: Align
  sortKey?: string
  defaultDirection?: SortDirection
  sortState?: SortState | null
  onSort?: (key: string, defaultDirection: SortDirection) => void
}) {
  // Plain header: skeleton case, or columns explicitly not sortable.
  if (!sortKey || !onSort) {
    return <th className={cn("px-4 py-3", TH_ALIGN[align])}>{label}</th>
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

  // For right-aligned columns the icon precedes the label so the trailing
  // edge of the cell is the label's last letter — matches the visual
  // alignment of the numeric cells below.
  const iconBeforeLabel = align === "right"

  return (
    <th className={cn("px-4 py-3", TH_ALIGN[align])} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey, defaultDirection)}
        className={cn(
          "hover:text-foreground inline-flex w-full items-center gap-1 transition-colors",
          BUTTON_JUSTIFY[align],
          active && "text-foreground"
        )}
      >
        {iconBeforeLabel ? (
          <>
            <Icon
              className={cn("size-3", active ? "text-brand" : "opacity-60")}
              aria-hidden
            />
            <span>{label}</span>
          </>
        ) : (
          <>
            <span>{label}</span>
            <Icon
              className={cn("size-3", active ? "text-brand" : "opacity-60")}
              aria-hidden
            />
          </>
        )}
      </button>
    </th>
  )
}
