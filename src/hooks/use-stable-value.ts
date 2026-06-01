import { useState } from "react"

/**
 * Returns a reference-stable view of `value`: the same object is handed back on
 * every render until the value's *content* changes, compared structurally via
 * JSON serialization.
 *
 * The stats charts key an expensive `echarts.setOption` off the identity of
 * their data prop. On a real-time site a refetch (SSE nudge → React Query)
 * hands back a fresh array on every poll even when the numbers are unchanged,
 * which would otherwise rebuild the chart on every nudge — re-running the
 * intro animation and, worse, racing echarts' hover lookup into a crash if the
 * rebuild lands while a viewer is hovering (`getRawIndex` on a disposed series
 * model). Feeding the data through this hook collapses value-identical polls to
 * a no-op so the chart is only touched when something actually changed.
 *
 * Implemented with the "adjust state during render" pattern (a guarded
 * set-state in render, which React applies before committing) rather than a
 * ref cache, so the returned identity is a semantic guarantee and the rule
 * against reading refs during render stays satisfied.
 *
 * `value` must be JSON-serializable — true of the charts' plain
 * number/string data, but not of values carrying functions, `undefined`, or
 * cyclic references.
 */
export function useStableValue<T>(value: T): T {
  const key = JSON.stringify(value)
  const [held, setHeld] = useState({ key, value })
  if (held.key !== key) {
    setHeld({ key, value })
    return value
  }
  return held.value
}
