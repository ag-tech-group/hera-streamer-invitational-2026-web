import { useEffect, useState, type RefObject } from "react"

/**
 * Whether `ref`'s element currently intersects the viewport.
 *
 * Defaults to `true` so the first paint, SSR, and environments without
 * `IntersectionObserver` (tests, legacy engines) never hide content that's
 * actually on screen — the observer then corrects it after mount. The mobile
 * standings use this to show the fixed sort bar only while the list is in
 * view, so scrolling down to the footer no longer leaves the bar over it.
 */
export function useInView<T extends Element>(
  ref: RefObject<T | null>
): boolean {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting)
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return inView
}
