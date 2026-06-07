import { List } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { STATS_SECTIONS } from "@/pages/stats/stats-sections"
import type { JumpVia } from "@/pages/stats/use-stats-nav"

interface NavSurfaceProps {
  activeId: string | null
  onJump: (id: string, via: JumpVia) => void
}

/**
 * Desktop table-of-contents rail (lg and up): a sticky vertical list of the
 * page's sections with a brand-accented marker on the one you're reading. The
 * continuous start-edge rule (the `border-s` track) with each item's own
 * transparent-to-brand segment gives the classic ToC "you are here" spine.
 */
export function StatsRail({ activeId, onJump }: NavSurfaceProps) {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t("stats.nav.label")}
      className="hidden lg:sticky lg:top-8 lg:block lg:self-start"
    >
      <p className="text-muted-foreground/70 font-display mb-3 ps-3 text-[10px] tracking-widest uppercase">
        {t("stats.nav.label")}
      </p>
      <ul className="border-border/60 flex flex-col border-s">
        {STATS_SECTIONS.map((section) => {
          const active = section.id === activeId
          return (
            <li key={section.id} className="-ms-px">
              <button
                type="button"
                onClick={() => onJump(section.id, "rail")}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "font-display block w-full rounded-e-md border-s-2 py-2 ps-3 pe-2 text-start text-xs leading-tight tracking-wider uppercase transition-colors",
                  "hover:bg-muted/50",
                  active
                    ? "border-brand text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                )}
              >
                {t(section.labelKey)}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * Mobile / tablet jump control (below lg): a sticky, glass "jump to section"
 * select pinned to the top of the stats column — the same backdrop-blur chrome
 * the standings sort bar uses (#351). Its value mirrors the scroll-spy, so it
 * always names the section you're in; picking another scrolls there. Bleeds to
 * the screen edges (`-mx-8` cancels the page padding) for a full-width bar.
 */
export function StatsJumpSelect({ activeId, onJump }: NavSurfaceProps) {
  const { t } = useTranslation()
  return (
    <div className="bg-card/85 supports-[backdrop-filter]:bg-card/70 sticky top-0 z-30 -mx-8 border-b px-8 py-2 backdrop-blur lg:hidden">
      <Select
        value={activeId ?? undefined}
        onValueChange={(id) => onJump(id, "select")}
      >
        <SelectTrigger
          aria-label={t("stats.nav.jumpTo")}
          className="h-11 w-full"
        >
          <span className="flex min-w-0 items-center gap-2">
            <List
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden
            />
            <span className="text-muted-foreground shrink-0 text-xs tracking-wide uppercase">
              {t("stats.nav.jumpToShort")}
            </span>
            <SelectValue
              placeholder={t("stats.nav.jumpTo")}
              className="truncate"
            />
          </span>
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={8}>
          {STATS_SECTIONS.map((section) => (
            <SelectItem key={section.id} value={section.id} className="py-2.5">
              {t(section.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
