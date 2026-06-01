import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useStableValue } from "@/hooks/use-stable-value"

describe("useStableValue", () => {
  it("keeps the original reference when re-rendered with value-equal data", () => {
    const first = [{ completedAt: "2026-06-01", rating: 1200 }]
    const { result, rerender } = renderHook(({ v }) => useStableValue(v), {
      initialProps: { v: first },
    })
    expect(result.current).toBe(first)

    // A fresh array with identical content — a stand-in for an SSE-driven
    // refetch that returned the same numbers in a new object.
    rerender({ v: [{ completedAt: "2026-06-01", rating: 1200 }] })
    expect(result.current).toBe(first)
  })

  it("returns the new reference when the content changes", () => {
    const { result, rerender } = renderHook(({ v }) => useStableValue(v), {
      initialProps: { v: [{ rating: 1200 }] },
    })
    const next = [{ rating: 1234 }]
    rerender({ v: next })
    expect(result.current).toBe(next)
  })

  it("tracks a growing collection (a player joining the series)", () => {
    const one = [{ id: 1 }]
    const { result, rerender } = renderHook(({ v }) => useStableValue(v), {
      initialProps: { v: one },
    })
    expect(result.current).toBe(one)

    const two = [{ id: 1 }, { id: 2 }]
    rerender({ v: two })
    expect(result.current).toBe(two)
  })
})
