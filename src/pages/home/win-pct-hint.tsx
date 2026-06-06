import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * Whether the primary pointer can hover (desktop mouse) vs. coarse/touch.
 * Same resolution as `bio-hint.tsx` — on hover-capable devices the win% value
 * itself is the trigger; on touch a tap on the value opens a popover with the
 * same breakdown. Kept live so a device-mode switch re-picks.
 */
function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(
    () => window.matchMedia?.("(hover: hover)").matches ?? true
  )
  useEffect(() => {
    const mql = window.matchMedia?.("(hover: hover)")
    if (!mql) return
    const onChange = () => setHoverCapable(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])
  return hoverCapable
}

/**
 * The breakdown body: the W–L split behind the percentage. Mirrors
 * `bio-hint.tsx`'s `BioCard` structure — a brand-dotted heading over the
 * detail line — so the two informational tooltips read as one family.
 */
function WinLossBreakdown({ wins, losses }: { wins: number; losses: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="bg-brand size-1.5 shrink-0 rounded-full" />
        <p className="text-foreground text-sm font-semibold">
          {t("standings.winPctBreakdown.title")}
        </p>
      </div>
      <p className="text-muted-foreground text-sm tabular-nums">
        <span className="text-chart-2-deep font-semibold">
          {t("standings.winPctBreakdown.wins", { count: wins })}
        </span>
        {" · "}
        <span className="text-destructive-deep font-semibold">
          {t("standings.winPctBreakdown.losses", { count: losses })}
        </span>
      </p>
    </div>
  )
}

/**
 * Win% value with a wins/losses breakdown on hover (desktop) or tap (touch).
 * Mirrors `BioHint`'s dual-primitive pattern so the disclosure feels identical
 * across the table. The trigger is the percentage itself; both primitives
 * portal their content, so it floats clear of the table's FLIP transforms on a
 * live re-sort. The `tooltip-surface` class adds the icy-blue top border + glow
 * (shared with the bio card).
 */
export function WinPctHint({
  wins,
  losses,
  children,
}: {
  wins: number
  losses: number
  /** The percentage node that acts as the trigger. */
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const hoverCapable = useHoverCapable()
  const label = t("standings.winPctBreakdown.aria", { wins, losses })

  if (hoverCapable) {
    return (
      <HoverCard openDelay={140} closeDelay={90}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label={label}
            // `hover:brightness-125` echoes the Watch icon's hover glow, shared
            // across the table's tooltip triggers so each hint reacts the same
            // way; `transition` eases the filter (near-white text glows faintly).
            className="cursor-default tabular-nums underline decoration-dotted decoration-1 underline-offset-4 transition hover:brightness-125"
          >
            {children}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="tooltip-surface w-auto min-w-44">
          <WinLossBreakdown wins={wins} losses={losses} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "tabular-nums underline decoration-dotted decoration-1 underline-offset-4",
            "hover:text-foreground transition-colors"
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="tooltip-surface w-auto min-w-44">
        <WinLossBreakdown wins={wins} losses={losses} />
      </PopoverContent>
    </Popover>
  )
}
