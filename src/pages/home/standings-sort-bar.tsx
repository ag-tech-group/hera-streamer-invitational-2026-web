import { ArrowDown, ArrowUp } from "lucide-react"
import { useEffect } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SortDirection, SortState } from "@/hooks/use-table-sort"
import { cn } from "@/lib/utils"
import {
  defaultDirectionFor,
  SORTABLE_COLUMNS,
} from "@/pages/home/standings-columns"

/**
 * Fixed bottom sort control for the mobile standings list.
 *
 * Pinned to the viewport (portaled to `document.body` so no transformed or
 * `overflow` ancestor can clip it, and respecting the home-indicator safe
 * area). It offers every sortable field via a `Select` and an ascending/
 * descending toggle, and writes straight to the shared `useTableSort` state
 * through `setSort` — so re-sorting here re-orders the list and swaps the
 * collapsed rows' metric column in lockstep, with no separate sort logic.
 *
 * The default (no active sort) is the peak-ranked order, which reads as
 * `maxRating` descending here — so the field shows "Peak" and the toggle shows
 * descending until the user picks something, and the first toggle/selection
 * materialises that into a concrete sort.
 */
export function StandingsSortBar({
  sortState,
  setSort,
  visible = true,
}: {
  sortState: SortState | null
  setSort: (key: string, direction: SortDirection) => void
  /** Slides the bar out of view (and inert) when the list is scrolled past. */
  visible?: boolean
}) {
  const { t } = useTranslation()

  // Reserve scroll runway *below the footer* (the page scrolls on <body>, and
  // the footer is the last flow child) so the last rows — and the footer
  // itself — can clear the fixed bar instead of sitting under it. Lives here,
  // scoped to the bar's lifetime, so only the mobile players view pays for it.
  useEffect(() => {
    const previous = document.body.style.paddingBottom
    document.body.style.paddingBottom =
      "calc(4.5rem + env(safe-area-inset-bottom))"
    return () => {
      document.body.style.paddingBottom = previous
    }
  }, [])

  const activeKey = sortState?.key ?? "maxRating"
  const activeDirection: SortDirection =
    sortState?.direction ?? defaultDirectionFor(activeKey)
  const ascending = activeDirection === "asc"

  // Selecting a field starts it at its natural direction (Radix fires this only
  // on a real change, so re-picking the active field won't reset its toggle).
  const handleFieldChange = (key: string) => {
    setSort(key, defaultDirectionFor(key))
  }
  const handleToggleDirection = () => {
    setSort(activeKey, ascending ? "desc" : "asc")
  }

  return createPortal(
    <div
      role="group"
      aria-label={t("standings.sort.title")}
      inert={!visible}
      className={cn(
        "bg-card/95 supports-[backdrop-filter]:bg-card/80 fixed inset-x-0 bottom-0 z-40 border-t px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur",
        "transition-transform duration-200 motion-reduce:transition-none",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="mx-auto flex max-w-[1536px] items-center gap-2">
        <span className="text-muted-foreground shrink-0 text-xs font-medium tracking-wide uppercase">
          {t("standings.sort.title")}
        </span>
        <Select value={activeKey} onValueChange={handleFieldChange}>
          <SelectTrigger className="h-11 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" side="top" sideOffset={8}>
            {SORTABLE_COLUMNS.map((col) => (
              <SelectItem key={col.key} value={col.key} className="py-2.5">
                {t(col.headerKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={handleToggleDirection}
          aria-pressed={!ascending}
          aria-label={t("standings.sort.directionLabel")}
          className={cn(
            "border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]"
          )}
        >
          {ascending ? (
            <ArrowUp className="size-4" aria-hidden />
          ) : (
            <ArrowDown className="size-4" aria-hidden />
          )}
          <span>
            {ascending
              ? t("standings.sort.ascending")
              : t("standings.sort.descending")}
          </span>
        </button>
      </div>
    </div>,
    document.body
  )
}
