import { describe, expect, it } from "vitest"

import { filterCountries, getCountries, type Country } from "@/lib/countries"

describe("getCountries", () => {
  it("resolves localized names and sorts them alphabetically", () => {
    const countries = getCountries("en")
    expect(countries.find((c) => c.code === "us")?.name).toBe("United States")

    const names = countries.map((c) => c.name)
    expect([...names].sort((a, b) => a.localeCompare(b, "en"))).toEqual(names)
  })

  it("localizes names per locale", () => {
    expect(getCountries("es").find((c) => c.code === "us")?.name).toBe(
      "Estados Unidos"
    )
  })

  it("returns a broad set of countries", () => {
    expect(getCountries("en").length).toBeGreaterThan(200)
  })
})

describe("filterCountries", () => {
  const countries: Country[] = [
    { code: "us", name: "United States" },
    { code: "gb", name: "United Kingdom" },
    { code: "kr", name: "South Korea" },
  ]

  it("returns every country for a blank query", () => {
    expect(filterCountries(countries, "  ")).toHaveLength(3)
  })

  it("matches the name in any position, case-insensitively", () => {
    expect(filterCountries(countries, "united").map((c) => c.code)).toEqual([
      "us",
      "gb",
    ])
    expect(filterCountries(countries, "KOREA")).toHaveLength(1)
  })

  it("matches the country code", () => {
    expect(filterCountries(countries, "kr")).toEqual([
      { code: "kr", name: "South Korea" },
    ])
  })
})
