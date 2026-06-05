import { describe, expect, it } from "vitest"

import {
  cleanMapName,
  countryCodeToFlagEmoji,
  flagEmojiToCountryCode,
  formatTimeAgo,
  normalizeCountryCode,
} from "@/lib/format"

describe("normalizeCountryCode", () => {
  it("returns a well-formed alpha-2 code unchanged", () => {
    expect(normalizeCountryCode("ca")).toBe("ca")
  })

  it("lowercases an uppercase code", () => {
    expect(normalizeCountryCode("KR")).toBe("kr")
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeCountryCode("  us  ")).toBe("us")
  })

  it("returns null for a missing code", () => {
    expect(normalizeCountryCode(null)).toBeNull()
    expect(normalizeCountryCode("")).toBeNull()
  })

  it("returns null for a malformed code", () => {
    expect(normalizeCountryCode("usa")).toBeNull()
    expect(normalizeCountryCode("x")).toBeNull()
    expect(normalizeCountryCode("12")).toBeNull()
  })
})

describe("countryCodeToFlagEmoji", () => {
  it("converts a lowercase alpha-2 code to its flag emoji", () => {
    expect(countryCodeToFlagEmoji("us")).toBe("🇺🇸")
    expect(countryCodeToFlagEmoji("kr")).toBe("🇰🇷")
  })

  it("normalizes case and surrounding whitespace before converting", () => {
    expect(countryCodeToFlagEmoji("US")).toBe("🇺🇸")
    expect(countryCodeToFlagEmoji("  ca ")).toBe("🇨🇦")
  })

  it("round-trips with flagEmojiToCountryCode", () => {
    const emoji = countryCodeToFlagEmoji("de")
    expect(emoji).not.toBeNull()
    expect(flagEmojiToCountryCode(emoji as string)).toBe("de")
  })

  it("returns null for a malformed code", () => {
    expect(countryCodeToFlagEmoji("usa")).toBeNull()
    expect(countryCodeToFlagEmoji("")).toBeNull()
    expect(countryCodeToFlagEmoji("1")).toBeNull()
  })
})

describe("formatTimeAgo", () => {
  const now = new Date("2026-05-21T12:00:00.000Z")
  const isoAgo = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it("collapses the last few seconds to 'just now'", () => {
    expect(formatTimeAgo(isoAgo(0), now)).toBe("just now")
    expect(formatTimeAgo(isoAgo(4_000), now)).toBe("just now")
  })

  it("reports whole seconds under a minute", () => {
    expect(formatTimeAgo(isoAgo(8_000), now)).toBe("8s ago")
    expect(formatTimeAgo(isoAgo(59_000), now)).toBe("59s ago")
  })

  it("reports whole minutes under an hour", () => {
    expect(formatTimeAgo(isoAgo(60_000), now)).toBe("1m ago")
    expect(formatTimeAgo(isoAgo(59 * 60_000), now)).toBe("59m ago")
  })

  it("reports whole hours under a day", () => {
    expect(formatTimeAgo(isoAgo(60 * 60_000), now)).toBe("1h ago")
    expect(formatTimeAgo(isoAgo(23 * 60 * 60_000), now)).toBe("23h ago")
  })

  it("reports whole days beyond a day", () => {
    expect(formatTimeAgo(isoAgo(24 * 60 * 60_000), now)).toBe("1d ago")
  })

  it("treats future timestamps as 'just now'", () => {
    expect(formatTimeAgo(isoAgo(-5_000), now)).toBe("just now")
  })
})

describe("cleanMapName", () => {
  it("strips a plain .rms extension", () => {
    expect(cleanMapName("Arabia.rms")).toBe("Arabia")
  })

  it("strips a numbered .rms2 extension", () => {
    expect(cleanMapName("megarandom.rms2")).toBe("megarandom")
  })

  it("strips scenario extensions", () => {
    expect(cleanMapName("Foo.scx")).toBe("Foo")
    expect(cleanMapName("Bar.aoe2scenario")).toBe("Bar")
  })

  it("keeps a multi-word name's spacing and casing", () => {
    expect(cleanMapName("Border Dispute.rms")).toBe("Border Dispute")
    expect(cleanMapName("EM Runestones.rms")).toBe("EM Runestones")
  })

  it("leaves a name with no known extension untouched", () => {
    expect(cleanMapName("Arabia")).toBe("Arabia")
  })

  it("only strips a trailing extension, not one mid-name", () => {
    expect(cleanMapName("Black.rms Forest.rms")).toBe("Black.rms Forest")
  })

  it("trims surrounding whitespace", () => {
    expect(cleanMapName("  Arabia.rms  ")).toBe("Arabia")
  })

  it("returns an empty string for empty input", () => {
    expect(cleanMapName("")).toBe("")
  })
})
