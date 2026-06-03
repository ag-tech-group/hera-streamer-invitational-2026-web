import { useCallback, useMemo, useState } from "react"

export type SortDirection = "asc" | "desc"

export interface SortState {
  key: string
  direction: SortDirection
}

/**
 * Cell value used for sorting. Strings compare locale-aware, numbers
 * numerically. `null` always sorts last regardless of direction so columns
 * with sparse data (e.g. unranked players) don't push genuine data off
 * screen on a descending sort.
 */
export type SortableValue = string | number | null

/**
 * Generic table-sort hook. Returns a stably-sorted view of `rows`, the
 * current sort state, and a `sortBy` callback that drives the three-state
 * cycle below.
 *
 * Click cycle for a single column:
 *   unsorted → click → defaultDirection
 *            → click → opposite direction
 *            → click → unsorted (restores the rows' original order)
 *
 * Clicking a *different* column resets to that column's `defaultDirection`,
 * which lets each column declare its own natural starting direction (string
 * columns usually `asc`, magnitude columns usually `desc`).
 *
 * `getValue` projects a row + sort key onto a comparable value. Component
 * code owns the mapping from `key` (a string identifier) to which row field
 * to sort on, so the hook stays generic.
 */
export function useTableSort<T>(
  rows: T[],
  getValue: (row: T, key: string) => SortableValue
): {
  sortedRows: T[]
  sortState: SortState | null
  sortBy: (key: string, defaultDirection?: SortDirection) => void
  clearSort: () => void
} {
  const [sort, setSort] = useState<SortState | null>(null)

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = getValue(a, sort.key)
      const bv = getValue(b, sort.key)
      // Nulls sort last regardless of direction: handled before applying
      // the asc/desc sign so descending doesn't surface them at the top.
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      const cmp = compareNonNull(av, bv)
      return sort.direction === "asc" ? cmp : -cmp
    })
    return copy
  }, [rows, sort, getValue])

  const sortBy = useCallback(
    (key: string, defaultDirection: SortDirection = "asc") => {
      setSort((prev) => {
        // Switching to a new column → start at its declared default.
        if (!prev || prev.key !== key) {
          return { key, direction: defaultDirection }
        }
        // Same column, currently at default → flip to the other direction.
        if (prev.direction === defaultDirection) {
          return {
            key,
            direction: defaultDirection === "asc" ? "desc" : "asc",
          }
        }
        // Same column, currently at the non-default direction → clear.
        return null
      })
    },
    []
  )

  // Jump straight back to the unsorted state in one call. The `sortBy` cycle
  // also reaches it (third click on a column), but some UIs want an explicit
  // "reset" affordance — e.g. the civ board's "Both" chip, which returns to its
  // dual-leaderboard default rather than making the user cycle a column.
  const clearSort = useCallback(() => setSort(null), [])

  return { sortedRows, sortState: sort, sortBy, clearSort }
}

/**
 * Comparator for two non-null sort values. Numbers compare numerically;
 * everything else is coerced to a string for locale-aware comparison.
 * Callers handle the null cases ahead of this so that nulls can pin to the
 * end regardless of the asc/desc sign.
 */
function compareNonNull(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b))
}
