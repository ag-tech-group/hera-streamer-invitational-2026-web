import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

/**
 * Whether this is a true mouse-pointer setup rather than a touch screen — the
 * same `(hover: hover) and (pointer: fine)` resolution `bio-hint.tsx` settled on
 * (#214): modern phones can report `hover: hover` alone, so the pointer clause
 * is what reliably distinguishes a mouse from a finger. Kept live so a
 * device-mode switch re-picks.
 */
const DESKTOP_POINTER_QUERY = "(hover: hover) and (pointer: fine)"

function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(
    () => window.matchMedia?.(DESKTOP_POINTER_QUERY).matches ?? true
  )
  useEffect(() => {
    const mql = window.matchMedia?.(DESKTOP_POINTER_QUERY)
    if (!mql) return
    const onChange = () => setHoverCapable(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])
  return hoverCapable
}

/**
 * The watch card body: a dotted heading naming the game (the live
 * `streamCategory`, or a generic "live" label when the platform reports none)
 * over the broadcast title. The heading dot echoes the row's trust colour —
 * brand when the stream is on AoE2 (or unclassifiable), foreground/white when
 * it's a confirmed off-game broadcast — so the tooltip and the Watch-column dot
 * tell the same story.
 */
function WatchCard({
  title,
  category,
  offGame,
}: {
  title: string | null
  category: string | null
  offGame: boolean
}) {
  const { t } = useTranslation()
  const heading = category ?? t("standings.streamingLive")
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            offGame ? "bg-foreground" : "bg-brand"
          )}
        />
        <p className="text-foreground text-sm font-semibold">{heading}</p>
      </div>
      {title && (
        <p className="text-muted-foreground text-sm leading-relaxed">{title}</p>
      )}
    </div>
  )
}

/**
 * Floats a styled card showing what a live player is streaming — the broadcast
 * title under a game-category heading — when its Watch icon (`children`) is
 * hovered on a desktop (#328). On touch the icon is left bare so a tap follows
 * its link straight to the stream; the title is a hover enrichment, not worth
 * stealing the primary "go watch" tap (unlike the bio, which has no other
 * affordance). Content is portaled, so it floats clear of the standings table's
 * FLIP transforms on a live re-sort, and the shared `tooltip-surface` chrome
 * makes it read as one family with `BioHint` / `WinPctHint`.
 */
export function WatchHint({
  title,
  category,
  offGame,
  children,
}: {
  /** Live broadcast title; the card's body line (omitted when null). */
  title: string | null
  /** Live game category for the heading; null falls back to a generic label. */
  category: string | null
  /** Whether the dot reads as confirmed off-game (foreground) vs on-AoE2 (brand). */
  offGame: boolean
  /** The Watch-icon link that acts as the hover trigger. */
  children: ReactNode
}) {
  const hoverCapable = useHoverCapable()
  if (!hoverCapable) return <>{children}</>
  return (
    <HoverCard openDelay={140} closeDelay={90}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="tooltip-surface w-auto max-w-xs">
        <WatchCard title={title} category={category} offGame={offGame} />
      </HoverCardContent>
    </HoverCard>
  )
}
