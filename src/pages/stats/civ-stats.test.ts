import { describe, expect, it } from "vitest"

import { toCivStats } from "@/pages/stats/civ-stats"
import type { CivCount } from "@/types"

// Known map ids: 27 Berbers, 7 Byzantines, 1 Britons.
const overall: CivCount[] = [
  { civId: 27, picks: 48, wins: 24 },
  { civId: 7, picks: 20, wins: 13 },
  { civId: 1, picks: 4, wins: 1 },
]

describe("toCivStats", () => {
  it("resolves civ names/emblems and ranks pick rate", () => {
    const { byPicks, matchCount } = toCivStats(overall, 1)
    expect(byPicks.map((c) => [c.name, c.emblem, c.picks, c.wins])).toEqual([
      ["Berbers", "berbers", 48, 24],
      ["Byzantines", "byzantines", 20, 13],
      ["Britons", "britons", 4, 1],
    ])
    expect(matchCount).toBe(72) // total entrant picks
  })

  it("computes win rate and ranks it high-to-low", () => {
    const { byWinPct } = toCivStats(overall, 1)
    expect(byWinPct.map((c) => c.name)).toEqual([
      "Byzantines",
      "Berbers",
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
    expect(byWinPct.map((c) => c.name)).toEqual(["Byzantines", "Berbers"])
    expect(byPicks.find((c) => c.name === "Britons")!.winPct).toBeNull()
  })

  it("skips unknown civ ids (Gaia 0, or a civ newer than the map)", () => {
    const out = toCivStats(
      [
        { civId: 0, picks: 5, wins: 3 },
        { civId: 60, picks: 2, wins: 1 },
      ],
      1
    )
    expect(out.byPicks).toEqual([])
    expect(out.matchCount).toBe(0)
  })

  it("returns empty views for no data", () => {
    expect(toCivStats([], 5).byPicks).toEqual([])
  })
})
