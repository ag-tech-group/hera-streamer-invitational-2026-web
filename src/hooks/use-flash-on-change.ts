import { useEffect, useRef, type RefObject } from "react"

/** Default duration of the flash, in milliseconds. */
const DEFAULT_DURATION_MS = 900

/**
 * Plays a brief background-colour flash on the referenced element whenever
 * `value` changes between renders (compared with `Object.is`). Used to draw
 * the eye to a standings cell whose data just changed via an SSE refetch.
 *
 * The hook tracks the previous value in a ref that is only read/written from
 * inside `useEffect`, so the render pass stays free of ref-during-render
 * patterns. The first render seeds the ref without animating — newly mounted
 * cells (including newly-arrived players) don't flash on first paint.
 *
 * Implemented with the Web Animations API so the keyframes don't leave a
 * lingering inline style on the element — the animation finishes back at the
 * cell's natural transparent background. `prefers-reduced-motion: reduce`
 * skips the animation; environments without WAAPI (e.g. jsdom in tests) are
 * a no-op.
 *
 * The flash colour comes from a CSS variable `--cell-flash` so callers can
 * style it from the design system instead of hard-coding a hex literal here.
 */
export function useFlashOnChange<E extends HTMLElement, T>(
  ref: RefObject<E | null>,
  value: T,
  durationMs: number = DEFAULT_DURATION_MS
): void {
  const previousRef = useRef<T>(value)

  useEffect(() => {
    if (Object.is(previousRef.current, value)) return
    previousRef.current = value

    if (prefersReducedMotion()) return
    const el = ref.current
    if (!el || typeof el.animate !== "function") return
    el.animate(
      [
        { backgroundColor: "var(--cell-flash)" },
        { backgroundColor: "transparent" },
      ],
      { duration: durationMs, easing: "ease-out" }
    )
  }, [value, durationMs, ref])
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}
