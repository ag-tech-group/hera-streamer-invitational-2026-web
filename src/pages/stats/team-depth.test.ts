import { describe, expect, it } from "vitest"

import { TEAM_HEX } from "@/lib/team-colors"
import { toDepthBars } from "@/pages/stats/team-depth"
import type { TeamMember, TeamStandingsRow } from "@/types"

function makeMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    tournamentPlayerId: 1,
    profileId: 1,
    alias: "player",
    country: null,
    currentRating: null,
    peakRating: 1000,
    inMatch: false,
    liveMatchId: null,
    isCaptain: false,
    ...overrides,
  }
}

function makeRow(overrides: Partial<TeamStandingsRow> = {}): TeamStandingsRow {
  const members = overrides.members ?? [makeMember()]
  const sum = members.reduce((s, m) => s + (m.peakRating ?? 0), 0)
  const rated = members.filter((m) => m.peakRating !== null).length
  return {
    teamId: 1,
    name: "Team One",
    initials: "T1",
    combinedRatingSum: sum,
    combinedRatingAverage: rated > 0 ? sum / rated : 0,
    members,
    ...overrides,
  }
}

const NO_NAMES = new Map<number, string>()

describe("toDepthBars", () => {
  it("returns [] for no rows", () => {
    expect(toDepthBars([], NO_NAMES)).toEqual([])
  })

  it("totals each bar to the team's combined-sum board value", () => {
    // The combined-sum board sums non-null member peaks; the stacked bar must
    // land on the same number so the two team boards never disagree (#300).
    const row = makeRow({
      members: [
        makeMember({ tournamentPlayerId: 1, peakRating: 1200 }),
        makeMember({ tournamentPlayerId: 2, peakRating: 1100 }),
        makeMember({ tournamentPlayerId: 3, peakRating: 900 }),
      ],
    })
    const [bar] = toDepthBars([row], NO_NAMES)
    expect(bar.total).toBe(3200)
    expect(bar.total).toBe(row.combinedRatingSum)
  })

  it("excludes members with no recorded peak (consistent with the sum)", () => {
    const row = makeRow({
      members: [
        makeMember({ tournamentPlayerId: 1, peakRating: 1200 }),
        makeMember({ tournamentPlayerId: 2, peakRating: null }),
      ],
    })
    const [bar] = toDepthBars([row], NO_NAMES)
    expect(bar.segments).toHaveLength(1)
    expect(bar.total).toBe(1200)
  })

  it("orders segments largest contribution first", () => {
    const row = makeRow({
      members: [
        makeMember({ tournamentPlayerId: 1, peakRating: 900 }),
        makeMember({ tournamentPlayerId: 2, peakRating: 1300 }),
        makeMember({ tournamentPlayerId: 3, peakRating: 1100 }),
      ],
    })
    const [bar] = toDepthBars([row], NO_NAMES)
    expect(bar.segments.map((s) => s.value)).toEqual([1300, 1100, 900])
  })

  it("labels a member by the host display-name override when present", () => {
    const row = makeRow({
      members: [makeMember({ tournamentPlayerId: 7, alias: "ladder_alias" })],
    })
    const [bar] = toDepthBars([row], new Map([[7, "Hera"]]))
    expect(bar.segments[0].label).toBe("Hera")
  })

  it("falls back to the raw alias, then a dash, when unnamed", () => {
    const row = makeRow({
      members: [
        makeMember({ tournamentPlayerId: 1, alias: "only_alias" }),
        makeMember({ tournamentPlayerId: 2, alias: null }),
      ],
    })
    const [bar] = toDepthBars([row], NO_NAMES)
    // Sorted largest-first, so order tracks peak, not input order — both default
    // to 1000 here, so input order holds.
    expect(bar.segments.map((s) => s.label)).toEqual(["only_alias", "—"])
  })

  it("paints the top contributor the full team hue and lightens the rest", () => {
    const row = makeRow({
      teamId: 1,
      members: [
        makeMember({ tournamentPlayerId: 1, peakRating: 1300 }),
        makeMember({ tournamentPlayerId: 2, peakRating: 1000 }),
      ],
    })
    const [bar] = toDepthBars([row], NO_NAMES)
    // Lowest team id → first colour slot (p1).
    expect(bar.segments[0].color).toBe(TEAM_HEX.p1)
    expect(bar.segments[1].color).not.toBe(TEAM_HEX.p1)
  })

  it("keeps a lone rated member at the full hue (no divide-by-zero)", () => {
    const row = makeRow({
      teamId: 1,
      members: [makeMember({ peakRating: 1234 })],
    })
    const [bar] = toDepthBars([row], NO_NAMES)
    expect(bar.segments).toHaveLength(1)
    expect(bar.segments[0].color).toBe(TEAM_HEX.p1)
  })

  it("colours by team identity, not list order — second team gets slot two", () => {
    const rows = [
      makeRow({ teamId: 5, name: "Five", members: [makeMember()] }),
      makeRow({ teamId: 2, name: "Two", members: [makeMember()] }),
    ]
    const bars = toDepthBars(rows, NO_NAMES)
    // teamColorMap assigns slots by id-ascending ordinal: id 2 → p1, id 5 → p2.
    expect(bars.find((b) => b.teamId === 2)!.segments[0].color).toBe(
      TEAM_HEX.p1
    )
    expect(bars.find((b) => b.teamId === 5)!.segments[0].color).toBe(
      TEAM_HEX.p2
    )
  })
})
