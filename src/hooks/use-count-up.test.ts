import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useCountUp } from "@/hooks/use-count-up"

// Controllable requestAnimationFrame so tests can step through ticks at exact
// timestamps. The default jsdom rAF runs on real time, which is too flaky for
// frame-by-frame assertions.
let rafCallbacks: Array<{ id: number; fn: FrameRequestCallback }>
let nextRafId: number

function flushRaf(timestamp: number): void {
  const due = rafCallbacks
  rafCallbacks = []
  for (const { fn } of due) fn(timestamp)
}

beforeEach(() => {
  rafCallbacks = []
  nextRafId = 1
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    const id = nextRafId++
    rafCallbacks.push({ id, fn })
    return id
  })
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    rafCallbacks = rafCallbacks.filter((cb) => cb.id !== id)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useCountUp", () => {
  it("snaps to the initial target without scheduling an animation", () => {
    const { result } = renderHook(({ target }) => useCountUp(target), {
      initialProps: { target: 1500 },
    })
    expect(result.current).toBe(1500)
    expect(rafCallbacks).toHaveLength(0)
  })

  it("tweens from the previous value to the new target over the duration", () => {
    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target, 1000),
      { initialProps: { target: 1000 } }
    )

    rerender({ target: 1200 })
    expect(result.current).toBe(1000)
    expect(rafCallbacks).toHaveLength(1)

    // First frame anchors startedAt; t=0 still shows the start value.
    act(() => flushRaf(0))
    expect(result.current).toBe(1000)

    // Halfway through (t=0.5, ease-out cubic = 0.875) → 1000 + 0.875 * 200 = 1175.
    act(() => flushRaf(500))
    expect(result.current).toBe(1175)

    // End of tween: snaps exactly to the target and stops scheduling frames.
    act(() => flushRaf(1000))
    expect(result.current).toBe(1200)
    expect(rafCallbacks).toHaveLength(0)
  })

  it("re-targets mid-tween from the value currently on screen", () => {
    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target, 1000),
      { initialProps: { target: 1000 } }
    )

    rerender({ target: 1200 })
    act(() => flushRaf(0))
    act(() => flushRaf(500))
    expect(result.current).toBe(1175)

    // New target arrives mid-flight. The next animation should start from 1175,
    // not from 1000, so the on-screen number doesn't jump back.
    rerender({ target: 1300 })
    act(() => flushRaf(0))
    expect(result.current).toBe(1175)

    act(() => flushRaf(1000))
    expect(result.current).toBe(1300)
  })

  it("snaps to target in a single zero-duration frame when prefers-reduced-motion is set", () => {
    const matchMediaSpy = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target),
      {
        initialProps: { target: 1000 },
      }
    )
    rerender({ target: 1500 })

    // Reduced-motion uses an effective duration of 0: still routed through
    // rAF (so setState never fires synchronously inside the effect), but
    // the very first tick has t=1 and lands directly on the target.
    expect(rafCallbacks).toHaveLength(1)
    act(() => flushRaf(0))
    expect(result.current).toBe(1500)
    expect(rafCallbacks).toHaveLength(0)
    matchMediaSpy.mockRestore()
  })

  it("is a no-op when the target re-renders unchanged", () => {
    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target),
      {
        initialProps: { target: 1000 },
      }
    )
    rerender({ target: 1000 })

    expect(result.current).toBe(1000)
    expect(rafCallbacks).toHaveLength(0)
  })
})
