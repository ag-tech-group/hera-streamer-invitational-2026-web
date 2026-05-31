import { Info } from "lucide-react"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
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
import { useAnalytics } from "@/lib/analytics"

/**
 * Whether this is a true mouse-pointer setup rather than a touch screen. Drives
 * the bio disclosure: on the desktop the player's name itself is the hover
 * target (no extra chrome); on touch — where hover is impossible and a tap on
 * the name should follow its link — a small tappable info icon sits beside it.
 *
 * Requires BOTH `(hover: hover)` and `(pointer: fine)` (#214). The old check was
 * `(hover: hover)` alone, but modern phones increasingly report themselves as
 * hover-capable — so a real phone fell into the desktop branch and never showed
 * the info icon, leaving the bio unreachable on touch (observed: icon present
 * in devtools device mode, absent on an actual phone). A mouse satisfies both
 * queries; a finger is `pointer: coarse`, so the combined query is the reliable
 * "is this a mouse" signal. Kept live so a device-mode switch re-picks.
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

/** The bio card body: a brand-dotted name heading over the host's blurb. */
function BioCard({ bio, name }: { bio: string; name: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="bg-brand size-1.5 shrink-0 rounded-full" />
        <p className="text-foreground text-sm font-semibold">{name}</p>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
        {bio}
      </p>
    </div>
  )
}

/**
 * Reveals a player's host-authored `presentation.bio` (#152). The player's
 * name (`children`) is the disclosure trigger on hover-capable devices — hover
 * it to surface the bio card while the underlying link still clicks through.
 * On touch the name renders as-is (a tap follows its link) with a small info
 * icon beside it that opens the bio. Content is portaled by both primitives,
 * so it floats clear of the standings table's FLIP transforms on a live
 * re-sort.
 */
export function BioHint({
  bio,
  name,
  profileId,
  alias,
  children,
}: {
  bio: string
  name: string
  /** Relic profile id (null for placeholder rows) — carried for analytics. */
  profileId: number | null
  /** Raw ladder alias — carried for analytics alongside the display name. */
  alias: string
  /** The player-name node that acts as the hover trigger on the desktop. */
  children: ReactNode
}) {
  const { t } = useTranslation()
  const analytics = useAnalytics()
  const hoverCapable = useHoverCapable()

  // #215: fire `player.bio.open` once, on the open transition only (the
  // primitive calls `onOpenChange` for both open and close).
  const onOpenChange = (open: boolean) => {
    if (open) analytics.track("player.bio.open", { profileId, alias })
  }

  if (hoverCapable) {
    return (
      <HoverCard openDelay={140} closeDelay={90} onOpenChange={onOpenChange}>
        <HoverCardTrigger asChild>{children}</HoverCardTrigger>
        <HoverCardContent className="tooltip-surface">
          <BioCard bio={bio} name={name} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <Popover onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("standings.bioLabel", { name })}
            // Negative margin keeps the glyph visually inline while the padding
            // grows the tap target to ~44px (#214 touch-target sizing) — the
            // hit area extends past the visible icon without shifting layout.
            className="text-muted-foreground hover:text-brand -m-2.5 inline-flex shrink-0 p-2.5 transition-colors"
          >
            <Info className="size-4" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="tooltip-surface w-64">
          <BioCard bio={bio} name={name} />
        </PopoverContent>
      </Popover>
    </span>
  )
}
