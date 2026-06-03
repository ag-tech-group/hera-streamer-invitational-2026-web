import { describe, expect, it } from "vitest"

import { civById, civEmblemUrl, CIV_BY_ID } from "@/lib/civilizations"

describe("civById", () => {
  it("resolves a known relic civ id to its display data", () => {
    expect(civById(27)).toEqual({ name: "Berbers", emblem: "berbers" })
    expect(civById(7)?.name).toBe("Byzantines")
  })

  it("uses the current display name, not the legacy internal name", () => {
    // civ_id 20's internal name is still "Indians"; it should read "Hindustanis".
    expect(civById(20)?.name).toBe("Hindustanis")
  })

  it("returns null for ids the map doesn't cover (Gaia 0, or a newer civ)", () => {
    expect(civById(0)).toBeNull()
    expect(civById(60)).toBeNull()
    expect(civById(999)).toBeNull()
  })

  it("maps every covered civ to an emblem basename", () => {
    for (const civ of Object.values(CIV_BY_ID)) {
      expect(civ.name).toBeTruthy()
      expect(civ.emblem).toMatch(/^[a-z]+$/)
    }
  })
})

describe("civEmblemUrl", () => {
  it("points at the public civ-emblems asset", () => {
    expect(civEmblemUrl("berbers")).toContain("civ-emblems/berbers.webp")
  })
})
