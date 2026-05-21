import { describe, expect, it } from "vitest"

import { formatTimeAgo } from "@/lib/format"

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
