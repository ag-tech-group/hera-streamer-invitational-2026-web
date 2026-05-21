import { useCallback, useLayoutEffect, useRef } from "react"

/**
 * Duration of a single row slide, in milliseconds. Deliberately on the slower
 * side: the reorder is a focal UX moment here — players watching the standings
 * move — not incidental chrome, so it should read clearly rather than flick by.
 */
const SLIDE_MS = 700
/** Easing for the slide — a gentle decelerate. */
const SLIDE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * Animates standings rows to their new positions whenever the row order
 * changes, using the FLIP technique (First, Last, Invert, Play).
 *
 * `useLayoutEffect` fires after React has committed the reordered rows but
 * before the browser paints. We measure each row's new position, compare it
 * with the position recorded on the previous run, and — for any row that
 * moved — play a transform from its old offset back to zero. The row appears
 * to slide from where it was to where it now is.
 *
 * Positions are measured relative to the `<tbody>` the caller attaches
 * `containerRef` to, so the animation is immune to page scroll and to layout
 * shifts elsewhere on the page. `prefers-reduced-motion` is honored.
 *
 * @param orderKey A string that changes iff the row order changes — it drives
 *   when re-measurement happens (e.g. the joined profile IDs).
 */
export function useFlipRows(orderKey: string) {
  const containerRef = useRef<HTMLTableSectionElement>(null)
  const rowNodes = useRef(new Map<number, HTMLTableRowElement>())
  const prevTops = useRef(new Map<number, number>())
  const running = useRef(new Map<number, Animation>())

  // A single stable ref callback for every row. Each <tr> carries its id in
  // `data-flip-id`; the callback reads it and returns a cleanup (React 19),
  // so row identity is tracked without a new closure per render.
  const registerRow = useCallback((node: HTMLTableRowElement | null) => {
    if (!node) return
    const id = Number(node.dataset.flipId)
    rowNodes.current.set(id, node)
    return () => {
      rowNodes.current.delete(id)
      running.current.delete(id)
    }
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Measure every row's top relative to the tbody (scroll-independent).
    const base = container.getBoundingClientRect().top
    const currentTops = new Map<number, number>()
    for (const [id, node] of rowNodes.current) {
      currentTops.set(id, node.getBoundingClientRect().top - base)
    }

    const isFirstRun = prevTops.current.size === 0
    if (!isFirstRun && !prefersReducedMotion()) {
      for (const [id, node] of rowNodes.current) {
        const from = prevTops.current.get(id)
        const to = currentTops.get(id)
        if (from === undefined || to === undefined) continue

        const delta = from - to
        // Skip rows that did not move, and environments without the Web
        // Animations API (e.g. jsdom in tests).
        if (Math.abs(delta) < 1 || typeof node.animate !== "function") continue

        // Cancel any in-flight slide so rapid reorders don't stack.
        running.current.get(id)?.cancel()
        running.current.set(
          id,
          node.animate(
            [
              { transform: `translateY(${delta}px)` },
              { transform: "translateY(0)" },
            ],
            { duration: SLIDE_MS, easing: SLIDE_EASING }
          )
        )
      }
    }

    prevTops.current = currentTops
  }, [orderKey])

  return { containerRef, registerRow }
}
