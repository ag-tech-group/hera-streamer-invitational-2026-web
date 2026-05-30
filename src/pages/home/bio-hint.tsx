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

/**
 * Whether the primary pointer can hover (a desktop mouse) rather than being
 * coarse/touch. Drives the bio disclosure: on the desktop the player's name
 * itself is the hover target (no extra chrome); on touch — where hover is
 * impossible and a tap on the name should follow its link — a small tappable
 * info icon sits beside it instead. Resolved from `(hover: hover)` and kept
 * live so a device-mode switch re-picks.
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
  children,
}: {
  bio: string
  name: string
  /** The player-name node that acts as the hover trigger on the desktop. */
  children: ReactNode
}) {
  const { t } = useTranslation()
  const hoverCapable = useHoverCapable()

  if (hoverCapable) {
    return (
      <HoverCard openDelay={140} closeDelay={90}>
        <HoverCardTrigger asChild>{children}</HoverCardTrigger>
        <HoverCardContent>
          <BioCard bio={bio} name={name} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("standings.bioLabel", { name })}
            className="text-muted-foreground hover:text-brand inline-flex shrink-0 transition-colors"
          >
            <Info className="size-4" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <BioCard bio={bio} name={name} />
        </PopoverContent>
      </Popover>
    </span>
  )
}
