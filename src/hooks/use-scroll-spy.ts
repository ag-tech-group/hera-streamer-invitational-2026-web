import { useEffect, useState } from "react"

/**
 * Tracks which of the given section ids is currently "active" — the topmost
 * section whose top edge sits in a trigger band near the top of the viewport.
 * Powers the stats-page nav (#354): the desktop rail highlight and the mobile
 * select's displayed value.
 *
 * A single `IntersectionObserver` watches every section. The asymmetric
 * `rootMargin` shrinks the observed area to a thin band just under the top of
 * the viewport (top inset clears the mobile sticky bar; the large bottom inset
 * means a section only counts once its heading has scrolled up near the top),
 * so "active" tracks what you're reading rather than flipping the moment a
 * section first peeks in from the bottom. Among the sections in the band we
 * take the first in `ids` order, i.e. the topmost.
 *
 * Returns the first id as a sensible default for the first paint, SSR, and
 * environments without `IntersectionObserver` (tests, legacy engines) — the
 * observer then corrects it after mount.
 *
 * `ids` must be referentially stable across renders (pass a module-level
 * constant); it's an effect dependency, so a fresh array each render would
 * re-create the observer every time.
 */
export function useScrollSpy(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const intersecting = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id)
          else intersecting.delete(entry.target.id)
        }
        const topmost = ids.find((id) => intersecting.has(id))
        // Only move the marker while *something* is in the band; when the band
        // is momentarily empty (e.g. a tall section spanning the whole gap) we
        // keep the last active id rather than clearing the highlight.
        if (topmost) setActiveId(topmost)
      },
      { rootMargin: "-88px 0px -60% 0px", threshold: 0 }
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ids])

  return activeId
}
