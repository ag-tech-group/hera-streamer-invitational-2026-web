import type { LabeledSeries } from "@/pages/stats/series-labels"

/** One player's series resampled onto the shared timeline, ready for echarts. */
export interface ChartSeries {
  tournamentPlayerId: number
  label: string
  /**
   * `[timestampMs, rating | null]` over the union of every player's match
   * times. `null` before the player's first match (no line yet); after it, the
   * last rating is carried forward — so a player who stops holds their value to
   * the latest match in the field instead of ending early.
   */
  data: Array<[number, number | null]>
}

/**
 * Forward-fills each player's rating series onto a shared timeline — the sorted
 * union of every completed-match timestamp across all players.
 *
 * Solves three things at once for the `/stats` chart (#280):
 * 1. **Tooltip.** With one shared x-set, the axis pointer lands on a real value
 *    for every line at the same instant, so the tooltip can list everyone's
 *    exact held rating — instead of snapping to whichever line happened to have
 *    a point near the cursor (the "hover is odd / shows the wrong player" bug).
 * 2. **Hold-on-stop.** A player's last rating is carried to the latest match in
 *    the field, so their line stays flat at its value rather than ending early
 *    when they stop playing.
 * 3. **Steps.** Between two of a player's own matches the value is constant, so
 *    with `step: "end"` the line holds then jumps exactly at the match that
 *    moved it — matching how a discrete rating actually behaves.
 *
 * `points` are oldest-first (the API contract), so a single forward walk per
 * player fills the row in O(union + points).
 */
export function toForwardFilledSeries(series: LabeledSeries[]): ChartSeries[] {
  const parsed = series.map((s) => ({
    series: s,
    points: s.points.map(
      (p) => [Date.parse(p.completedAt), p.rating] as [number, number]
    ),
  }))

  const times = [
    ...new Set(parsed.flatMap(({ points }) => points.map(([ms]) => ms))),
  ].sort((a, b) => a - b)

  return parsed.map(({ series: s, points }) => {
    let i = 0
    let held: number | null = null
    const data = times.map((t): [number, number | null] => {
      while (i < points.length && points[i][0] <= t) {
        held = points[i][1]
        i++
      }
      return [t, held]
    })
    return { tournamentPlayerId: s.tournamentPlayerId, label: s.label, data }
  })
}
