import { useCallback, useSyncExternalStore } from "react"

/**
 * Subscribe to a CSS media query and re-render when it flips.
 *
 * Built on `useSyncExternalStore` so the *first* render already reflects the
 * real match — no desktop→mobile flash on mount, the way a `useState(false)` +
 * `useEffect` hook would flicker. Returns `false` where `matchMedia` is
 * unavailable (SSR, ancient engines), matching `useHoverCapable`'s guard.
 *
 * The standings view uses this to swap the wide desktop table for the mobile
 * list at the width where the table would otherwise start scrolling sideways —
 * a layout decision that has to be made in JS (not just CSS `hidden`) so only
 * one of the two row trees mounts, keeping the FLIP animation's `data-flip-id`
 * keys and the accessibility tree free of duplicate rows.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia?.(query)
      if (!mql) return () => {}
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [query]
  )
  const getSnapshot = () => window.matchMedia?.(query).matches ?? false
  // No DOM during SSR — report "not matching" so the server and the first
  // client paint agree (the client then re-reads on mount via the store).
  const getServerSnapshot = () => false
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
