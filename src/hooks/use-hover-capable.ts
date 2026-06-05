import { useEffect, useState } from "react"

/**
 * Whether the primary input is a true mouse pointer (desktop) rather than a
 * touch screen, via `(hover: hover) and (pointer: fine)` — the combined query
 * #214 settled on: modern phones can report `hover: hover` alone, so the
 * `pointer: fine` clause is what reliably tells a mouse from a finger. Drives
 * the standings tooltips' hover-vs-tap split and, for the recent-form pips,
 * their spacing + tap-target size. Kept live (subscribed) so a devtools
 * device-mode switch re-picks. Defaults to `true` (assume desktop) where
 * `matchMedia` is unavailable.
 *
 * NB: `bio-hint` / `win-pct-hint` / `watch-hint` predate this shared hook and
 * still inline their own copy of the same logic; this is the canonical home for
 * new callers (and where those three should consolidate).
 */
const DESKTOP_POINTER_QUERY = "(hover: hover) and (pointer: fine)"

export function useHoverCapable(): boolean {
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
