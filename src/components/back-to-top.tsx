import { ArrowUp } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

/**
 * Floating "back to top" button (#354). Stays hidden until the page has
 * scrolled roughly a screenful (so it never crowds the top) and then fades in;
 * clicking scrolls smoothly back to the very top, honouring reduced motion.
 *
 * Pinned via a fixed layer that mirrors the page container (centred,
 * max-w-[1536px], px-8) with `justify-end`, so on desktop it lines up under the
 * stats rail's column (`w-52` == the grid's `13rem` rail) instead of floating in
 * the raw viewport corner; below lg it simply rests at the content's inline-end.
 * `justify-end` + px-8 are direction-aware, so it flips to the left under RTL
 * (Arabic) like the rest of the chrome. Self-contained (owns its own visibility
 * + scroll), so it can drop onto any long page sharing the container width; an
 * optional `onActivate` fires on click before the scroll — the stats page uses
 * it to clear the section fragment from the URL.
 */
export function BackToTop({ onActivate }: { onActivate?: () => void }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const toTop = () => {
    onActivate?.()
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" })
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 mx-auto flex max-w-[1536px] justify-end px-8">
      {/* Desktop: match the rail column's width (w-52 == 13rem) and centre the
          button in it so it sits under the rail. Mobile: shrinks to the button,
          parked at the content's inline-end. */}
      <div className="flex justify-center lg:w-52">
        <button
          type="button"
          onClick={toTop}
          aria-label={t("stats.nav.backToTop")}
          aria-hidden={!visible}
          tabIndex={visible ? 0 : -1}
          className={cn(
            "flex size-11 items-center justify-center rounded-full border",
            "bg-card/90 text-foreground shadow-lg backdrop-blur",
            "hover:border-brand/50 hover:bg-accent",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
            "transition-all duration-200 motion-reduce:transition-none",
            visible
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-3 opacity-0"
          )}
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
