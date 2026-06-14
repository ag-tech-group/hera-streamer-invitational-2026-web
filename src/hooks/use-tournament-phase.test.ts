import { describe, expect, it } from "vitest"

import { derivePhase } from "@/hooks/use-tournament-phase"

// The King's Gauntlet's real window: June 1 → June 16 18:00 GMT.
const START = "2026-06-01T00:00:00Z"
const END = "2026-06-16T18:00:00Z"
const at = (iso: string) => new Date(iso).getTime()

describe("derivePhase", () => {
  it("is 'before' ahead of the start date", () => {
    expect(derivePhase(at("2026-05-31T23:59:59Z"), START, END)).toBe("before")
  })

  it("counts the start instant as active (inclusive)", () => {
    expect(derivePhase(at(START), START, END)).toBe("active")
  })

  it("is 'active' between start and end", () => {
    expect(derivePhase(at("2026-06-10T12:00:00Z"), START, END)).toBe("active")
  })

  it("flips to 'ended' at the end instant and stays there after", () => {
    expect(derivePhase(at(END), START, END)).toBe("ended")
    expect(derivePhase(at("2026-06-20T00:00:00Z"), START, END)).toBe("ended")
  })

  it("prefers 'ended' when both dates are already in the past", () => {
    expect(derivePhase(at("2027-01-01T00:00:00Z"), START, END)).toBe("ended")
  })

  it("is 'before' when no dates are set", () => {
    expect(derivePhase(at("2026-06-10T00:00:00Z"), null, null)).toBe("before")
    expect(derivePhase(at("2026-06-10T00:00:00Z"), undefined, undefined)).toBe(
      "before"
    )
  })

  it("ends on end_date even with no start date", () => {
    expect(derivePhase(at("2026-06-20T00:00:00Z"), null, END)).toBe("ended")
    // Before the end with no start, the race hasn't "begun" — stays 'before'.
    expect(derivePhase(at("2026-06-10T00:00:00Z"), null, END)).toBe("before")
  })
})
