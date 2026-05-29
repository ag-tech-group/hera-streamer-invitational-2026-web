import { describe, expect, it } from "vitest"

import { teamColorSlot } from "@/lib/team-colors"

describe("teamColorSlot", () => {
  it("maps team ids 1-8 to the eight AoE2 colour slots in order", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(teamColorSlot)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
    ])
  })

  it("wraps back to the start past eight teams", () => {
    expect(teamColorSlot(9)).toBe("p1")
    expect(teamColorSlot(10)).toBe("p2")
  })
})
