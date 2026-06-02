import { describe, expect, it } from "vitest"

import { toForwardFilledSeries } from "@/pages/stats/progression-series"
import type { LabeledSeries } from "@/pages/stats/series-labels"

const t1 = "2026-06-01T00:00:00Z"
const t2 = "2026-06-01T01:00:00Z"
const t3 = "2026-06-01T02:00:00Z"

function makeSeries(
  id: number,
  label: string,
  pts: Array<[string, number]>
): LabeledSeries {
  return {
    tournamentPlayerId: id,
    profileId: id,
    alias: label,
    label,
    points: pts.map(([completedAt, rating]) => ({ completedAt, rating })),
  }
}

describe("toForwardFilledSeries", () => {
  it("returns [] for no series", () => {
    expect(toForwardFilledSeries([])).toEqual([])
  })

  it("aligns every series to the shared union of match times", () => {
    const a = makeSeries(1, "A", [
      [t1, 100],
      [t3, 110],
    ])
    const b = makeSeries(2, "B", [[t2, 200]])

    const out = toForwardFilledSeries([a, b])
    const aData = out.find((s) => s.tournamentPlayerId === 1)!.data
    const bData = out.find((s) => s.tournamentPlayerId === 2)!.data

    const sharedTimes = [Date.parse(t1), Date.parse(t2), Date.parse(t3)]
    expect(aData.map((d) => d[0])).toEqual(sharedTimes)
    expect(bData.map((d) => d[0])).toEqual(sharedTimes)
  })

  it("holds a player's last rating between their own matches", () => {
    // A plays at t1 and t3; B plays at t2. At t2, A has no new match, so it
    // holds 100 (the value from t1), not 110 (which doesn't land until t3).
    const a = makeSeries(1, "A", [
      [t1, 100],
      [t3, 110],
    ])
    const b = makeSeries(2, "B", [[t2, 200]])

    const aData = toForwardFilledSeries([a, b]).find(
      (s) => s.tournamentPlayerId === 1
    )!.data
    expect(aData.map((d) => d[1])).toEqual([100, 100, 110])
  })

  it("is null before a player's first match (no line yet)", () => {
    const a = makeSeries(1, "A", [[t1, 100]])
    const b = makeSeries(2, "B", [[t3, 200]])

    const bData = toForwardFilledSeries([a, b]).find(
      (s) => s.tournamentPlayerId === 2
    )!.data
    // B's first match is t3, so it's null at t1 and t3 is its first value.
    expect(bData.map((d) => d[1])).toEqual([null, 200])
  })

  it("holds a stopped player's value to the latest match in the field", () => {
    // B stops after t1; A keeps playing through t3. B's line should hold 200
    // across t2 and t3 rather than ending at t1 (the hold-on-stop fix).
    const a = makeSeries(1, "A", [
      [t1, 100],
      [t2, 105],
      [t3, 110],
    ])
    const b = makeSeries(2, "B", [[t1, 200]])

    const bData = toForwardFilledSeries([a, b]).find(
      (s) => s.tournamentPlayerId === 2
    )!.data
    expect(bData.map((d) => d[1])).toEqual([200, 200, 200])
  })

  it("preserves the resolved label", () => {
    const a = makeSeries(1, "Day9TV", [[t1, 100]])
    expect(toForwardFilledSeries([a])[0].label).toBe("Day9TV")
  })
})
