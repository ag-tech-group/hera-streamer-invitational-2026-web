import { describe, expect, it } from "vitest"

import { lightenHex } from "@/lib/team-colors"
import { toPlayerRace, toTeamRace } from "@/pages/stats/elo-race"
import type {
  PlayerHistory,
  StandingsHistorySnapshot,
  TeamHistory,
} from "@/types"

// A shared three-bucket axis. The API aligns every entity to it and ranks them
// server-side (#226), so these tests exercise the thin shaping — value mapping,
// order, colour, the rated/roster filter — not any ranking math.
const BUCKETS = [
  "2026-06-01T00:00:00Z",
  "2026-06-02T00:00:00Z",
  "2026-06-03T00:00:00Z",
]

/**
 * A team whose combined peak elo at each bucket is given (position irrelevant
 * here). `name` is the label the history payload now carries (#243).
 */
function team(
  teamId: number,
  elos: number[],
  name = `T${teamId}`
): TeamHistory {
  return {
    teamId,
    name,
    points: elos.map((combinedPeakElo) => ({ position: 1, combinedPeakElo })),
  }
}

/** A player whose peak rating at each bucket is given (null = unrated that bucket). */
function player(
  id: number,
  peaks: (number | null)[],
  name = `P${id}`
): PlayerHistory {
  return {
    tournamentPlayerId: id,
    profileId: id,
    name,
    points: peaks.map((peakRating) => ({ position: 1, peakRating })),
  }
}

function history(parts: {
  players?: PlayerHistory[]
  teams?: TeamHistory[]
}): StandingsHistorySnapshot {
  return {
    lastPolledAt: null,
    buckets: BUCKETS,
    players: parts.players ?? [],
    teams: parts.teams ?? [],
  }
}

describe("toTeamRace", () => {
  const teamHexByTeamId = new Map([
    [10, "#3b82f6"],
    [20, "#ef4444"],
  ])
  const opts = { teamHexByTeamId }

  it("passes the shared buckets through; no teams → no entities", () => {
    const out = toTeamRace(history({}), opts)
    expect(out.buckets).toEqual(BUCKETS)
    expect(out.entities).toEqual([])
  })

  it("maps each team's combinedPeakElo to per-bucket values, labelled + coloured", () => {
    const out = toTeamRace(
      history({ teams: [team(10, [5900, 5950, 6000], "Knights")] }),
      opts
    )
    expect(out.entities).toHaveLength(1)
    expect(out.entities[0]).toMatchObject({
      id: 10,
      label: "Knights",
      color: "#3b82f6",
      values: [5900, 5950, 6000],
    })
  })

  it("orders teams current-leader-first by latest elo", () => {
    const out = toTeamRace(
      history({
        teams: [team(10, [5900, 5900, 5900]), team(20, [4000, 5000, 6100])],
      }),
      opts
    )
    // Team 20 starts behind but finishes ahead — the latest bucket decides order.
    expect(out.entities.map((e) => e.id)).toEqual([20, 10])
  })

  it("labels from the history name; neutral colour for a team absent from the hue map", () => {
    // Team 99 has no entry in the colour map → neutral hue; its label still
    // comes straight from the history payload's name (#243).
    const out = toTeamRace(history({ teams: [team(99, [100], "Lone")] }), opts)
    expect(out.entities[0].label).toBe("Lone")
    expect(out.entities[0].color).toBe("#94a3b8")
  })
})

describe("toPlayerRace", () => {
  const base = "#3b82f6"
  const opts = {
    rosterIds: new Set([1, 2, 3]),
    teamIdByTournamentPlayerId: new Map([
      [1, 10],
      [2, 10],
      [3, 20],
    ]),
    baseHexByTeamId: new Map([
      [10, base],
      [20, "#ef4444"],
    ]),
  }

  it("maps peak per bucket; a null before the first rated match becomes 0", () => {
    const out = toPlayerRace(
      history({ players: [player(1, [null, 1500, 1600])] }),
      opts
    )
    expect(out.entities[0].values).toEqual([0, 1500, 1600])
  })

  it("drops never-rated and off-roster (phantom) entities", () => {
    const out = toPlayerRace(
      history({
        players: [
          player(1, [1500, 1500, 1500]), // rated + on the roster → in
          player(2, [null, null, null]), // on roster but never rated → out
          player(404, [1700, 1700, 1700]), // not on the standings roster → out
        ],
      }),
      opts
    )
    expect(out.entities.map((e) => e.id)).toEqual([1])
  })

  it("orders players current-leader-first by latest peak", () => {
    const out = toPlayerRace(
      history({
        players: [player(1, [1500, 1500, 1500]), player(3, [1400, 1600, 1800])],
      }),
      opts
    )
    expect(out.entities.map((e) => e.id)).toEqual([3, 1])
  })

  it("colours by team, shading teammates apart within the hue", () => {
    // 1 and 2 are teammates (team 10); 1 finishes ahead, so it keeps the full
    // hue and 2 is lightened — matching the bump chart's shared shading.
    const out = toPlayerRace(
      history({
        players: [player(1, [1600, 1600, 1600]), player(2, [1500, 1500, 1500])],
      }),
      opts
    )
    const colorOf = (id: number) => out.entities.find((e) => e.id === id)!.color
    expect(colorOf(1)).toBe(base)
    expect(colorOf(2)).toBe(lightenHex(base, 0.45))
  })
})
