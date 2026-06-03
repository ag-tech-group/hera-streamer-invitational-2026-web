import { describe, expect, it } from "vitest"

import { civEmblemUrl } from "@/lib/civilizations"

describe("civEmblemUrl", () => {
  it("resolves a civ name to its public emblem asset", () => {
    expect(civEmblemUrl("Berbers")).toContain("civ-emblems/berbers.webp")
    expect(civEmblemUrl("Byzantines")).toContain("civ-emblems/byzantines.webp")
  })

  it("handles the API's legacy ladder names that match the asset filenames", () => {
    // The API forwards World's Edge names like "Mayans"/"Incas"/"Indians",
    // which lower-case straight onto the shield basenames.
    expect(civEmblemUrl("Mayans")).toContain("mayans.webp")
    expect(civEmblemUrl("Incas")).toContain("incas.webp")
    expect(civEmblemUrl("Indians")).toContain("indians.webp")
  })

  it("guards the Hindustanis rename onto the legacy 'indians' asset", () => {
    // If upstream ever switches to the current in-game name.
    expect(civEmblemUrl("Hindustanis")).toContain("indians.webp")
  })

  it("returns null for a civ we have no shield for", () => {
    expect(civEmblemUrl("Gaia")).toBeNull()
    expect(civEmblemUrl("Martians")).toBeNull()
  })
})
