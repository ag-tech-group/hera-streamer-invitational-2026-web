import { describe, expect, it } from "vitest"

import { toCivStats } from "@/pages/stats/civ-stats"
import type { CivCount } from "@/types"

// API civ-stats counts: the API delivers the `name`; `civId` is the World's
// Edge id (a stable key, not used for naming).
const overall: CivCount[] = [
  { civId: 27, name: "Magyars", picks: 48, wins: 24 },
  { civId: 11, name: "Byzantines", picks: 20, wins: 13 },
  { civId: 7, name: "Britons", picks: 4, wins: 1 },
]

describe("toCivStats", () => {
  it("uses the API name, resolves the emblem, and ranks pick rate", () => {
    const { byPicks, matchCount } = toCivStats(overall, 1)
    expect(byPicks.map((c) => [c.name, c.picks, c.wins])).toEqual([
      ["Magyars", 48, 24],
      ["Byzantines", 20, 13],
      ["Britons", 4, 1],
    ])
    expect(byPicks[0].emblemUrl).toContain("civ-emblems/magyars.webp")
    expect(matchCount).toBe(72) // total entrant picks
  })

  it("computes win rate and ranks it high-to-low", () => {
    const { byWinPct } = toCivStats(overall, 1)
    expect(byWinPct.map((c) => c.name)).toEqual([
      "Byzantines",
      "Magyars",
      "Britons",
    ])
    expect(byWinPct[0].winPct).toBe(65) // 13/20
    expect(byWinPct[1].winPct).toBe(50) // 24/48
    expect(byWinPct[2].winPct).toBe(25) // 1/4
  })

  it("gates win rate behind the minimum-pick threshold", () => {
    const { byPicks, byWinPct } = toCivStats(overall, 5)
    // Britons (4 picks) still counts for pick rate…
    expect(byPicks.some((c) => c.name === "Britons")).toBe(true)
    // …but is excluded from win rate, and its winPct is null.
    expect(byWinPct.map((c) => c.name)).toEqual(["Byzantines", "Magyars"])
    expect(byPicks.find((c) => c.name === "Britons")!.winPct).toBeNull()
  })

  it("skips a civ the API couldn't name (null name)", () => {
    const out = toCivStats(
      [
        { civId: 0, name: null, picks: 5, wins: 3 },
        { civId: 99, name: null, picks: 2, wins: 1 },
      ],
      1
    )
    expect(out.byPicks).toEqual([])
    expect(out.matchCount).toBe(0)
  })

  it("still shows a named civ we have no shield for, emblem null", () => {
    const out = toCivStats(
      [{ civId: 123, name: "Martians", picks: 3, wins: 2 }],
      1
    )
    expect(out.byPicks).toHaveLength(1)
    expect(out.byPicks[0].name).toBe("Martians")
    expect(out.byPicks[0].emblemUrl).toBeNull()
  })

  it("returns empty views for no data", () => {
    expect(toCivStats([], 5).byPicks).toEqual([])
  })
})
