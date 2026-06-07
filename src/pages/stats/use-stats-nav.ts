import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect } from "react"

import { useScrollSpy } from "@/hooks/use-scroll-spy"
import { useAnalytics } from "@/lib/analytics"
import { STATS_SECTION_IDS } from "@/pages/stats/stats-sections"

/** How the jump was triggered — distinguishes the two nav surfaces in analytics. */
export type JumpVia = "rail" | "select"

/**
 * Smooth-scrolls the page to a section anchor, honouring the reduced-motion
 * preference (the long stats page is exactly where a big animated jump is
 * unwelcome for motion-sensitive users). The matching `scroll-mt-*` on each
 * section keeps the heading clear of the mobile sticky bar.
 */
function jumpToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  el.scrollIntoView({
    behavior: prefersReduced ? "auto" : "smooth",
    block: "start",
  })
}

/**
 * Shared state for the stats nav (#354): the scroll-spy's active section and a
 * jump handler that logs the navigation, writes the section to the URL fragment
 * (so cards are shareable / bookmarkable), then scrolls. Computed once in the
 * page and passed to both nav surfaces so they stay in lockstep (one observer,
 * one highlighted section across the rail and the select).
 */
export function useStatsNav() {
  const analytics = useAnalytics()
  const navigate = useNavigate()
  const activeId = useScrollSpy(STATS_SECTION_IDS)

  // Deep link: on first mount, honour a `/stats#<section>` fragment so a shared
  // link lands on that card. One frame's delay lets the section skeletons lay
  // out first; the scroll is instant — a deep link should arrive there, not
  // animate down from the top. Mount-only, so later in-page jumps (which set the
  // hash themselves) don't re-trigger it.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id || !STATS_SECTION_IDS.includes(id)) return
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" })
    })
  }, [])

  const onJump = useCallback(
    (id: string, via: JumpVia) => {
      analytics.track("stats.nav.jump", { to: id, via })
      // Reflect the section in the URL for shareable links — `replace` so
      // section-hopping doesn't pile up history entries. `hashScrollIntoView:
      // false` suppresses the router's own *instant* jump to the fragment, so
      // our smooth scroll below isn't preempted.
      void navigate({
        to: "/stats",
        hash: id,
        replace: true,
        hashScrollIntoView: false,
      })
      jumpToSection(id)
    },
    [analytics, navigate]
  )

  // Drop the section fragment (the back-to-top button calls this): a bare
  // `/stats` with no hash. With no hash the router won't hash-scroll, and there's
  // no scroll restoration, so this never moves the page on its own — the smooth
  // scroll-to-top stays the button's job and isn't preempted.
  const clearFragment = useCallback(() => {
    void navigate({ to: "/stats", replace: true, hashScrollIntoView: false })
  }, [navigate])

  return { activeId, onJump, clearFragment }
}
