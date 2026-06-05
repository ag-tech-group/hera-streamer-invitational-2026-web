import { describe, expect, it } from "vitest"

import { lightenHex } from "@/lib/team-colors"
import { toBumpSeries } from "@/pages/stats/bump-series"
import type {
  PlayerHistory,
  PositionPoint,
  StandingsHistorySnapshot,
} from "@/types"

// A shared three-bucket axis. The API ranks every entity at every bucket (#226),
// so points are never null; these tests exercise the thin shaping (order / label
// / colour), not any ranking math, which lives server-side.
const BUCKETS = [
  "2026-06-01T00:00:00Z",
  "2026-06-02T00:00:00Z",
  "2026-06-03T00:00:00Z",
]

function pt(position: number, peakRating: number | null = null): PositionPoint {
  return { position, peakRating }
}

/**
 * A player whose position at each bucket is given (peak rating irrelevant here).
 * `name` is the resolved label the history payload now carries (#243) — the
 * chart reads its legend straight from it.
 */
function player(
  tournamentPlayerId: number,
  positions: number[],
  name = `P${tournamentPlayerId}`
): PlayerHistory {
  return {
    tournamentPlayerId,
    profileId: tournamentPlayerId,
    name,
    points: positions.map((p) => pt(p)),
  }
}

function history(players: PlayerHistory[]): StandingsHistorySnapshot {
  return { lastPolledAt: null, buckets: BUCKETS, players, teams: [] }
}

const NO_TEAMS = {
  rosterIds: new Set<number>(),
  teamIdByTournamentPlayerId: new Map<number, number>(),
  baseHexByTeamId: new Map<number, string>(),
}

/**
 * Opts marking the given ids as current standings entrants (no teams). The
 * chart filters to the roster — the #326 phantom guard — so a test that expects
 * a player to appear has to list it here.
 */
function onRoster(ids: number[]) {
  return { ...NO_TEAMS, rosterIds: new Set(ids) }
}

describe("toBumpSeries", () => {
  it("passes the shared buckets through; no players → no series", () => {
    const out = toBumpSeries(history([]), NO_TEAMS)
    expect(out.buckets).toEqual(BUCKETS)
    expect(out.series).toEqual([])
  })

  it("keeps every entity and passes its position points through", () => {
    const out = toBumpSeries(history([player(1, [2, 2, 1])]), onRoster([1]))
    expect(out.series).toHaveLength(1)
    expect(out.series[0].points.map((p) => p.position)).toEqual([2, 2, 1])
  })

  it("labels each line from the history payload's name (#243)", () => {
    const out = toBumpSeries(
      history([player(1, [1, 1, 1], "Hera")]),
      onRoster([1])
    )
    expect(out.series[0].label).toBe("Hera")
  })

  it("orders by current (last-bucket) position — leader first", () => {
    const a = player(1, [2, 2, 1]) // climbs to 1st
    const b = player(2, [1, 1, 2]) // slips to 2nd
    const out = toBumpSeries(history([b, a]), onRoster([1, 2])) // passed worst-first
    expect(out.series.map((s) => s.tournamentPlayerId)).toEqual([1, 2])
  })

  it("drops history entities missing from the standings roster (no phantom rows)", () => {
    // Player 2 has position history but isn't a current standings entrant — a
    // transient non-entrant the history endpoint surfaced. It carries a resolved
    // name too, so roster membership (not the label) is what filters it: the
    // chart's roster has to equal the standings table's (#326 follow-up).
    const out = toBumpSeries(
      history([player(1, [1, 1, 1], "Hera"), player(2, [2, 2, 2])]),
      onRoster([1])
    )
    expect(out.series.map((s) => s.tournamentPlayerId)).toEqual([1])
    expect(out.series[0].label).toBe("Hera")
  })

  it("colours each line by its team, shading teammates apart within the hue", () => {
    // Players 4 and 5 are teammates (team 10); 4 currently outranks 5.
    const base = "#3b82f6"
    const out = toBumpSeries(
      history([player(4, [1, 1, 1], "D"), player(5, [2, 2, 2], "P")]),
      {
        rosterIds: new Set([4, 5]),
        teamIdByTournamentPlayerId: new Map([
          [4, 10],
          [5, 10],
        ]),
        baseHexByTeamId: new Map([[10, base]]),
      }
    )
    const colorOf = (label: string) =>
      out.series.find((s) => s.label === label)!.color
    // Higher-ranked teammate keeps the full hue; the next is lightened.
    expect(colorOf("D")).toBe(base)
    expect(colorOf("P")).toBe(lightenHex(base, 0.45))
  })

  it("falls back to a neutral colour when a player has no team", () => {
    const out = toBumpSeries(history([player(1, [1, 1, 1])]), onRoster([1]))
    expect(out.series[0].color).toBe("#94a3b8")
  })
})
