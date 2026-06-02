import { describe, expect, it } from "vitest"

import { lightenHex } from "@/lib/team-colors"
import { toBumpSeries } from "@/pages/stats/bump-series"
import type { LabeledSeries } from "@/pages/stats/series-labels"

// Three UTC days; the noon timestamps fall inside their day's midnight bucket.
const D1 = "2026-06-01T12:00:00Z"
const D2 = "2026-06-02T12:00:00Z"
const D3 = "2026-06-03T12:00:00Z"
const DAY1 = Date.UTC(2026, 5, 1)
const DAY2 = Date.UTC(2026, 5, 2)
const DAY3 = Date.UTC(2026, 5, 3)

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

const NO_TEAMS = {
  teamIdByTournamentPlayerId: new Map<number, number>(),
  baseHexByTeamId: new Map<number, string>(),
}

describe("toBumpSeries", () => {
  it("returns [] for no series", () => {
    expect(toBumpSeries([], { ...NO_TEAMS, topN: 8 })).toEqual([])
  })

  it("ignores series with no points", () => {
    const empty = makeSeries(1, "Empty", [])
    expect(toBumpSeries([empty], { ...NO_TEAMS, topN: 8 })).toEqual([])
  })

  it("ranks the full field within each daily bucket (1 = highest rating)", () => {
    // Day1 ratings A1000 B1600 C900 → B1, A2, C3.
    const a = makeSeries(1, "A", [[D1, 1000]])
    const b = makeSeries(2, "B", [[D1, 1600]])
    const c = makeSeries(3, "C", [[D1, 900]])
    const out = toBumpSeries([a, b, c], { ...NO_TEAMS, topN: 8 })
    const rankOf = (label: string) =>
      out.find((s) => s.label === label)!.points[0].rank
    expect(rankOf("B")).toBe(1)
    expect(rankOf("A")).toBe(2)
    expect(rankOf("C")).toBe(3)
  })

  it("buckets by UTC day, stamping each node at the day's midnight", () => {
    const a = makeSeries(1, "A", [
      [D1, 1000],
      [D2, 1100],
      [D3, 1200],
    ])
    const [series] = toBumpSeries([a], { ...NO_TEAMS, topN: 8 })
    expect(series.points.map((p) => p.t)).toEqual([DAY1, DAY2, DAY3])
  })

  it("ranks against the whole field so a climb reads as a climb", () => {
    // A climbs past the field; among ALL three players A goes 3rd → 2nd → 1st.
    // Ranking only among the shown leaders would hide (or invert) that.
    const a = makeSeries(1, "A", [
      [D1, 1000],
      [D2, 1300],
      [D3, 1700],
    ])
    const b = makeSeries(2, "B", [[D1, 1600]]) // stops; holds 1600
    const c = makeSeries(3, "C", [
      [D1, 1200],
      [D2, 1250],
      [D3, 1300],
    ])
    const out = toBumpSeries([a, b, c], { ...NO_TEAMS, topN: 8 })
    expect(out.find((s) => s.label === "A")!.points.map((p) => p.rank)).toEqual(
      [3, 2, 1]
    )
  })

  it("forward-fills a stopped player, who slides as others pass", () => {
    const a = makeSeries(1, "A", [
      [D1, 1000],
      [D2, 1300],
      [D3, 1700],
    ])
    const b = makeSeries(2, "B", [[D1, 1600]])
    const c = makeSeries(3, "C", [
      [D1, 1200],
      [D2, 1250],
      [D3, 1300],
    ])
    const bOut = toBumpSeries([a, b, c], { ...NO_TEAMS, topN: 8 }).find(
      (s) => s.label === "B"
    )!
    // B never plays again but holds 1600 — its rating is carried, and its rank
    // slides 1 → 1 → 2 as A overtakes on day 3.
    expect(bOut.points.map((p) => p.rating)).toEqual([1600, 1600, 1600])
    expect(bOut.points.map((p) => p.rank)).toEqual([1, 1, 2])
  })

  it("shows only players who reached the top N in some bucket — surgers and sliders", () => {
    // C never breaks the top 2 (always 3rd), so it's omitted; A and B remain.
    const a = makeSeries(1, "A", [
      [D1, 1000],
      [D2, 1300],
      [D3, 1700],
    ])
    const b = makeSeries(2, "B", [[D1, 1600]])
    const c = makeSeries(3, "C", [
      [D1, 900],
      [D2, 950],
      [D3, 1000],
    ])
    const out = toBumpSeries([a, b, c], { ...NO_TEAMS, topN: 2 })
    expect(out.map((s) => s.label)).toEqual(["A", "B"]) // ordered by latest rank
  })

  it("orders the output by current (last-bucket) rank", () => {
    const a = makeSeries(1, "A", [[D1, 1700]])
    const b = makeSeries(2, "B", [[D1, 1600]])
    const out = toBumpSeries([a, b], { ...NO_TEAMS, topN: 8 })
    expect(out.map((s) => s.label)).toEqual(["A", "B"])
  })

  it("colours each line by its team, shading teammates apart within the hue", () => {
    // D and P are teammates (team 10); D currently outranks P.
    const d = makeSeries(4, "D", [[D1, 2000]])
    const p = makeSeries(5, "P", [[D1, 1900]])
    const base = "#3b82f6"
    const out = toBumpSeries([d, p], {
      teamIdByTournamentPlayerId: new Map([
        [4, 10],
        [5, 10],
      ]),
      baseHexByTeamId: new Map([[10, base]]),
      topN: 8,
    })
    const colorOf = (label: string) => out.find((s) => s.label === label)!.color
    // Higher-ranked teammate keeps the full hue; the next is lightened.
    expect(colorOf("D")).toBe(base)
    expect(colorOf("P")).toBe(lightenHex(base, 0.45))
  })

  it("falls back to a neutral colour when a player has no team", () => {
    const a = makeSeries(1, "A", [[D1, 1500]])
    const [series] = toBumpSeries([a], { ...NO_TEAMS, topN: 8 })
    expect(series.color).toBe("#94a3b8")
  })
})
