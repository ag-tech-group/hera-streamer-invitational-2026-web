import { describe, expect, it } from "vitest"

import { lightenHex, TEAM_HEX, teamColorMap } from "@/lib/team-colors"

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

describe("TEAM_HEX", () => {
  it("maps every colour slot to a 6-digit hex", () => {
    const slots = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"] as const
    for (const slot of slots) {
      expect(TEAM_HEX[slot]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe("lightenHex", () => {
  it("returns the same colour at amount 0", () => {
    expect(lightenHex("#3b82f6", 0)).toBe("#3b82f6")
  })

  it("returns white at amount 1", () => {
    expect(lightenHex("#3b82f6", 1)).toBe("#ffffff")
  })

  it("mixes halfway toward white at amount 0.5", () => {
    // Each channel moves halfway to 255: black → 128 (0x80) on every channel.
    expect(lightenHex("#000000", 0.5)).toBe("#808080")
  })

  it("clamps out-of-range amounts", () => {
    expect(lightenHex("#3b82f6", 2)).toBe("#ffffff")
    expect(lightenHex("#3b82f6", -1)).toBe("#3b82f6")
  })

  it("only ever lightens — no channel drops below the original", () => {
    const lit = lightenHex("#3b82f6", 0.4)
    const channels = (hex: string) =>
      [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
    const before = channels("#3b82f6")
    const after = channels(lit)
    after.forEach((c, i) => expect(c).toBeGreaterThanOrEqual(before[i]))
  })
})
