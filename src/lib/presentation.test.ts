import { describe, expect, it } from "vitest"

import { presentationDisplayName } from "@/lib/presentation"

describe("presentationDisplayName", () => {
  it("returns the trimmed override when set", () => {
    expect(presentationDisplayName({ displayName: "  TheViper  " })).toBe(
      "TheViper"
    )
  })

  it("returns undefined for a missing, blank, or non-string override", () => {
    expect(presentationDisplayName({})).toBeUndefined()
    expect(presentationDisplayName({ displayName: "   " })).toBeUndefined()
    expect(presentationDisplayName({ displayName: 42 })).toBeUndefined()
  })

  it("returns undefined for a non-object bag", () => {
    expect(presentationDisplayName(undefined)).toBeUndefined()
    expect(presentationDisplayName(null)).toBeUndefined()
    expect(presentationDisplayName("nope")).toBeUndefined()
  })
})
