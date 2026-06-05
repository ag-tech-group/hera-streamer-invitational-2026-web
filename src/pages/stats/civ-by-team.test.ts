import { describe, expect, it } from "vitest"

import { toCivByTeam } from "@/pages/stats/civ-by-team"
import type { TeamColorSlot } from "@/lib/team-colors"
import type {
  CivCount,
  PlayerCivCounts,
  TeamMember,
  TeamStandingsRow,
} from "@/types"

function civ(
  civId: number,
  name: string,
  picks: number,
  wins: number
): CivCount {
  return { civId, name, picks, wins }
}
function player(id: number, civs: CivCount[]): PlayerCivCounts {
  return { tournamentPlayerId: id, profileId: id, civs }
}
function member(id: number): TeamMember {
  return {
    tournamentPlayerId: id,
    profileId: id,
    alias: null,
    country: null,
    currentRating: null,
    peakRating: null,
    inMatch: false,
    liveMatchId: null,
    isCaptain: false,
  }
}
function team(teamId: number, name: string, ids: number[]): TeamStandingsRow {
  return {
    teamId,
    name,
    initials: name.slice(0, 2).toUpperCase(),
    combinedRatingSum: 0,
    combinedRatingAverage: 0,
    members: ids.map(member),
  }
}

const OPTS = {
  labelByTournamentPlayerId: new Map([
    [1, "Alice"],
    [2, "Bob"],
  ]),
  slotByTeamId: new Map<number, TeamColorSlot>([[10, "p1"]]),
  minTeamWinPicks: 4,
}

const byPlayer: PlayerCivCounts[] = [
  player(1, [
    civ(27, "Magyars", 10, 8),
    civ(31, "Mongols", 4, 1),
    civ(1, "Britons", 1, 1),
  ]),
  player(2, [civ(27, "Magyars", 6, 3), civ(7, "Byzantines", 3, 2)]),
]

describe("toCivByTeam", () => {
  it("groups members under their team with the team name + colour", () => {
    const [g] = toCivByTeam(byPlayer, [team(10, "Team A", [1, 2])], OPTS)
    expect(g.name).toBe("Team A")
    expect(g.colorSlot).toBe("p1")
    expect(g.players.map((p) => p.label)).toEqual(["Alice", "Bob"])
  })

  it("gives each player the civs they main (top picks, by pick count)", () => {
    const [g] = toCivByTeam(byPlayer, [team(10, "Team A", [1, 2])], OPTS)
    const alice = g.players.find((p) => p.tournamentPlayerId === 1)!
    expect(alice.topPicks.map((c) => c.name)).toEqual([
      "Magyars",
      "Mongols",
      "Britons",
    ])
  })

  it("aggregates the team's tops across members", () => {
    const [g] = toCivByTeam(byPlayer, [team(10, "Team A", [1, 2])], OPTS)
    // Magyars summed: 10+6=16 picks, 8+3=11 wins.
    expect(g.topPicks[0]).toMatchObject({
      name: "Magyars",
      picks: 16,
      wins: 11,
    })
    // Team win% gated at ≥4 picks: Magyars (16) + Mongols (4) qualify;
    // Byzantines (3) and Britons (1) don't. Ordered by win% (raw, non-null).
    expect(g.topWins.map((c) => [c.name, Math.round(c.winPct)])).toEqual([
      ["Magyars", 69], // 11/16
      ["Mongols", 25], // 1/4
    ])
  })

  it("omits members with no civ data (no completed games)", () => {
    // Player 3 isn't in by_player at all.
    const [g] = toCivByTeam(byPlayer, [team(10, "Team A", [1, 2, 3])], OPTS)
    expect(g.players.map((p) => p.tournamentPlayerId)).toEqual([1, 2])
  })

  it("falls back to a dash for an unlabeled player", () => {
    const [g] = toCivByTeam(
      [player(9, [civ(1, "Britons", 3, 2)])],
      [team(10, "Team A", [9])],
      OPTS
    )
    expect(g.players[0].label).toBe("—") // never a UUID
  })

  it("orders teams by id (palette order), regardless of API rank order", () => {
    // API serves teams in live-rank order; the cards must stay put. Input here
    // is reversed (20 before 10) — output is sorted ascending by teamId.
    const out = toCivByTeam(
      byPlayer,
      [team(20, "Team B", [2]), team(10, "Team A", [1])],
      OPTS
    )
    expect(out.map((g) => g.teamId)).toEqual([10, 20])
  })

  it("skips a civ the API couldn't name", () => {
    const out = toCivByTeam(
      [
        {
          tournamentPlayerId: 1,
          profileId: 1,
          civs: [
            { civId: 99, name: null, picks: 5, wins: 3 },
            civ(27, "Magyars", 2, 1),
          ],
        },
      ],
      [team(10, "Team A", [1])],
      OPTS
    )
    expect(out[0].players[0].topPicks.map((c) => c.name)).toEqual(["Magyars"])
  })
})
