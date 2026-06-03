import { describe, expect, it } from "vitest"

import { toCivStats } from "@/pages/stats/civ-stats"
import type { Match, MatchOutcome, MatchPlayer } from "@/types"

// Known civ ids from the static map: 27 Berbers, 7 Byzantines, 1 Britons.
function player(
  civilizationId: number,
  outcome: MatchOutcome | null,
  overrides: Partial<MatchPlayer> = {}
): MatchPlayer {
  return {
    profileId: 1,
    civilizationId,
    teamId: 1,
    outcome,
    oldRating: 1500,
    newRating: 1510,
    xpGained: 100,
    ...overrides,
  }
}

function match(players: MatchPlayer[], overrides: Partial<Match> = {}): Match {
  return {
    matchId: 1,
    mapName: "Arabia",
    matchtypeId: 0,
    leaderboardId: 3,
    startedAt: "2026-06-02T10:00:00Z",
    completedAt: "2026-06-02T10:30:00Z",
    description: null,
    state: "completed",
    updatedAt: "2026-06-02T10:31:00Z",
    players,
    ...overrides,
  }
}

// Berbers 3 picks / 2 wins, Byzantines 2 / 1, Britons 1 / 0.
const sample: Match[] = [
  match([player(27, "win"), player(7, "loss")]),
  match([player(27, "win"), player(1, "loss")]),
  match([player(7, "win"), player(27, "loss")]),
]

describe("toCivStats", () => {
  it("counts picks and wins per civ and ranks pick rate", () => {
    const { byPicks, matchCount } = toCivStats(sample, 1)
    expect(matchCount).toBe(3)
    expect(byPicks.map((c) => [c.name, c.picks, c.wins])).toEqual([
      ["Berbers", 3, 2],
      ["Byzantines", 2, 1],
      ["Britons", 1, 0],
    ])
  })

  it("computes win rate and ranks it high-to-low", () => {
    const { byWinPct } = toCivStats(sample, 1)
    expect(byWinPct.map((c) => c.name)).toEqual([
      "Berbers",
      "Byzantines",
      "Britons",
    ])
    expect(byWinPct[0].winPct).toBeCloseTo(66.67, 1)
    expect(byWinPct[1].winPct).toBe(50)
    expect(byWinPct[2].winPct).toBe(0)
  })

  it("gates win rate behind the minimum-pick threshold", () => {
    const { byPicks, byWinPct } = toCivStats(sample, 2)
    // Britons (1 pick) still counts for pick rate…
    expect(byPicks.some((c) => c.name === "Britons")).toBe(true)
    // …but is excluded from win rate, and its winPct is null.
    expect(byWinPct.map((c) => c.name)).toEqual(["Berbers", "Byzantines"])
    expect(byPicks.find((c) => c.name === "Britons")!.winPct).toBeNull()
  })

  it("skips unknown civ ids (Gaia 0, or a civ newer than the map)", () => {
    const stats = toCivStats([match([player(0, "win"), player(60, "loss")])], 1)
    expect(stats.byPicks).toEqual([])
    expect(stats.matchCount).toBe(1)
  })

  it("ignores matches that aren't completed", () => {
    const live = [
      match([player(27, null), player(7, null)], {
        state: "in_progress",
        completedAt: null,
      }),
    ]
    const stats = toCivStats(live, 1)
    expect(stats.byPicks).toEqual([])
    expect(stats.matchCount).toBe(0)
  })
})
