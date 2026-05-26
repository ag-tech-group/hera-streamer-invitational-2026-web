import { useEffect, useRef, useState } from "react"

/**
 * Default tween duration in milliseconds — long enough that a rating change
 * reads as a deliberate ticking-up motion, short enough that successive SSE
 * nudges don't visibly queue up.
 */
const DEFAULT_DURATION_MS = 800

/**
 * Animates `target` over `durationMs`, returning the currently-displayed
 * integer. Uses requestAnimationFrame with an ease-out cubic so the change
 * moves quickly then settles.
 *
 * The first render snaps to `target` so a freshly-mounted standings table
 * doesn't tween every value up from zero. When `target` changes again
 * mid-tween, the new animation starts from the value currently on screen
 * (not from the previously-stored target) — visually continuous when SSE
 * nudges land in quick succession. `prefers-reduced-motion: reduce` collapses
 * every change to an instant snap.
 */
export function useCountUp(
  target: number,
  durationMs: number = DEFAULT_DURATION_MS
): number {
  const [display, setDisplay] = useState(target)

  // Latest displayed value, kept in a ref so the animation effect can read it
  // without taking `display` as a dependency (which would re-run the effect
  // on every frame). The ref is synced via a dedicated effect that runs after
  // each commit — so when the animation effect fires later in the same flush,
  // the ref already reflects the latest committed display value.
  const displayRef = useRef(target)
  useEffect(() => {
    displayRef.current = display
  }, [display])

  const rafRef = useRef<number | null>(null)
  const lastTargetRef = useRef(target)
  const hasInitialized = useRef(false)

  useEffect(() => {
    // First commit: useState already snapped display to `target`, just record it.
    if (!hasInitialized.current) {
      hasInitialized.current = true
      lastTargetRef.current = target
      return
    }

    if (lastTargetRef.current === target) return
    lastTargetRef.current = target

    // Reduced-motion / SSR fallback: a zero-duration animation. The tick
    // routes through `requestAnimationFrame` (or a microtask if rAF is
    // missing), so `setDisplay` always fires in an async callback rather
    // than synchronously inside this effect body.
    const reduceMotion = prefersReducedMotion()
    const noRaf = !canAnimate()
    const effectiveDuration = reduceMotion || noRaf ? 0 : durationMs

    if (noRaf) {
      queueMicrotask(() => setDisplay(target))
      return
    }

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
    }

    const from = displayRef.current
    const to = target
    let startedAt: number | null = null

    const tick = (now: number): void => {
      if (startedAt === null) startedAt = now
      const t =
        effectiveDuration === 0
          ? 1
          : Math.min(1, (now - startedAt) / effectiveDuration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [target, durationMs])

  return display
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

function canAnimate(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
  )
}
