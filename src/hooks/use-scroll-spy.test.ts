import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useScrollSpy } from "@/hooks/use-scroll-spy"

type Entry = { isIntersecting: boolean; target: { id: string } }

const ORIGINAL_IO = global.IntersectionObserver

afterEach(() => {
  global.IntersectionObserver = ORIGINAL_IO
  document.body.replaceChildren()
})

describe("useScrollSpy", () => {
  it("defaults to the first id before any intersection fires", () => {
    const { result } = renderHook(() => useScrollSpy(["a", "b", "c"]))
    expect(result.current).toBe("a")
  })

  it("activates the topmost in-view section, in id order", () => {
    // Swap in a controllable observer so the test can drive intersections.
    let fire: (entries: Entry[]) => void = () => {}
    class ControllableIO {
      constructor(cb: (entries: Entry[]) => void) {
        fire = cb
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn(() => [])
    }
    global.IntersectionObserver =
      ControllableIO as unknown as typeof IntersectionObserver

    const ids = ["a", "b", "c"]
    for (const id of ids) {
      const el = document.createElement("section")
      el.id = id
      document.body.appendChild(el)
    }

    const { result } = renderHook(() => useScrollSpy(ids))
    expect(result.current).toBe("a")

    // Both b and c are in view; b precedes c in id order, so it's the active one.
    act(() => {
      fire([
        { isIntersecting: true, target: { id: "c" } },
        { isIntersecting: true, target: { id: "b" } },
      ])
    })
    expect(result.current).toBe("b")

    // b leaves the band → c becomes the topmost remaining section.
    act(() => {
      fire([{ isIntersecting: false, target: { id: "b" } }])
    })
    expect(result.current).toBe("c")
  })
})
