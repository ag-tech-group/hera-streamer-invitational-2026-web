import { describe, expect, it } from "vitest"

import { teamColorMap } from "@/lib/team-colors"

describe("teamColorMap", () => {
  it("assigns the eight AoE2 colour slots in creation (id-ascending) order", () => {
    const map = teamColorMap([1, 2, 3, 4, 5, 6, 7, 8])
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((id) => map.get(id))).toEqual([
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

  it("colours by ordinal position, not raw id — gaps don't leak (#231)", () => {
    // The first-created surviving team (id 3) is blue even though earlier ids
    // were deleted; the gap to 5 and 8 doesn't shift the palette.
    const map = teamColorMap([3, 5, 8])
    expect(map.get(3)).toBe("p1")
    expect(map.get(5)).toBe("p2")
    expect(map.get(8)).toBe("p3")
  })

  it("is order-independent — the input array order doesn't change the mapping", () => {
    const map = teamColorMap([8, 3, 5])
    expect(map.get(3)).toBe("p1")
    expect(map.get(5)).toBe("p2")
    expect(map.get(8)).toBe("p3")
  })

  it("de-duplicates repeated ids", () => {
    const map = teamColorMap([3, 3, 5, 5])
    expect(map.size).toBe(2)
    expect(map.get(3)).toBe("p1")
    expect(map.get(5)).toBe("p2")
  })

  it("wraps back to the start past eight teams", () => {
    const ids = Array.from({ length: 10 }, (_, i) => i + 1)
    const map = teamColorMap(ids)
    expect(map.get(9)).toBe("p1")
    expect(map.get(10)).toBe("p2")
  })
})
