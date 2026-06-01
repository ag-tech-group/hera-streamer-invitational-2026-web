import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useFlipRows } from "@/pages/home/use-flip-rows"

/**
 * Per-row top offset (px) the stubbed `getBoundingClientRect` reports, keyed by
 * the row's `data-flip-id`. The `<tbody>` the hook measures against has no flip
 * id and reads 0, so a row's measured top equals its entry here. Mutated
 * between renders to simulate the layout the browser would produce after a
 * reorder.
 */
let tops: Record<string, number> = {}

/**
 * Every `Element.animate(...)` the hook fires, tagged with the row it ran on, so
 * a test can assert which rows slid and by how much. jsdom ships no Web
 * Animations API, so without the stub below this — the hook's whole reason for
 * existing — is invisible to the suite. That blind spot is exactly how #182's
 * regression (numeric `Number(flipId)` → `NaN` keys collapsing every row onto
 * one Map entry) reached production unnoticed.
 */
let animateCalls: Array<{ id: string | undefined; keyframes: unknown }> = []

let originalAnimate: unknown

beforeEach(() => {
  tops = {}
  animateCalls = []

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const id = (this as HTMLElement).dataset?.flipId
      return { top: id ? (tops[id] ?? 0) : 0 } as unknown as DOMRect
    }
  )

  originalAnimate = (Element.prototype as { animate?: unknown }).animate
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    writable: true,
    value: vi.fn(function (this: Element, keyframes: unknown) {
      animateCalls.push({
        id: (this as HTMLElement).dataset?.flipId,
        keyframes,
      })
      return { cancel: vi.fn() } as unknown as Animation
    }),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    writable: true,
    value: originalAnimate,
  })
})

/**
 * Minimal table wired to the hook the same way `StandingsTable` is: a `<tbody>`
 * carrying `containerRef` and one `<tr ref={registerRow} data-flip-id>` per id.
 * Reordering `rowIds` reorders the rows while keeping each node mounted (stable
 * React key), mirroring how a live standings refresh moves rows.
 */
function Table({ rowIds }: { rowIds: string[] }) {
  const { containerRef, registerRow } = useFlipRows(rowIds.join(","))
  return (
    <table>
      <tbody ref={containerRef}>
        {rowIds.map((id) => (
          <tr key={id} data-flip-id={id} ref={registerRow} />
        ))}
      </tbody>
    </table>
  )
}

describe("useFlipRows", () => {
  it("animates every row that moved, and only those, on a reorder", () => {
    // Three rows stacked 40px apart.
    tops = { "id:1": 0, "id:2": 40, "id:3": 80 }
    const { rerender } = render(<Table rowIds={["id:1", "id:2", "id:3"]} />)

    // The first commit only records positions — nothing slides yet.
    expect(animateCalls).toHaveLength(0)

    // Swap the top two: id:2 rises to the top, id:1 drops to second, id:3 stays.
    tops = { "id:1": 40, "id:2": 0, "id:3": 80 }
    rerender(<Table rowIds={["id:2", "id:1", "id:3"]} />)

    // Both moved rows slide; the stationary one does not. The flip ids are
    // opaque `rowKey` strings — under the `Number(flipId)` → `NaN` regression
    // (#182) every row collapsed onto one Map entry and this was 0 slides.
    const movedIds = animateCalls.map((call) => call.id).sort()
    expect(movedIds).toEqual(["id:1", "id:2"])
  })

  it("inverts each moved row from its previous position (FLIP delta)", () => {
    tops = { "id:1": 0, "id:2": 40 }
    const { rerender } = render(<Table rowIds={["id:1", "id:2"]} />)

    tops = { "id:1": 40, "id:2": 0 }
    rerender(<Table rowIds={["id:2", "id:1"]} />)

    const keyframesById = new Map(
      animateCalls.map((call) => [call.id, call.keyframes])
    )
    // id:1 moved down 40px (0 → 40): it starts inverted at -40 and plays to 0.
    expect(keyframesById.get("id:1")).toEqual([
      { transform: "translateY(-40px)" },
      { transform: "translateY(0)" },
    ])
    // id:2 moved up 40px (40 → 0): starts at +40 and plays to 0.
    expect(keyframesById.get("id:2")).toEqual([
      { transform: "translateY(40px)" },
      { transform: "translateY(0)" },
    ])
  })

  it("keys on the raw string id, so a non-numeric flip id never collapses to NaN", () => {
    // The hook treats flip ids as opaque strings. A non-numeric id like `"tbd"`
    // coerces to `NaN` under `Number(flipId)` — the exact #182 collapse where
    // every such row folded onto one Map entry. A mix of a numeric-string id
    // (the real `rowKey` shape) and a non-numeric one must each animate
    // independently.
    tops = { "19": 0, tbd: 40 }
    const { rerender } = render(<Table rowIds={["19", "tbd"]} />)

    tops = { "19": 40, tbd: 0 }
    rerender(<Table rowIds={["tbd", "19"]} />)

    const movedIds = animateCalls.map((call) => call.id).sort()
    expect(movedIds).toEqual(["19", "tbd"])
  })

  it("does not animate when prefers-reduced-motion is set", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    tops = { "id:1": 0, "id:2": 40 }
    const { rerender } = render(<Table rowIds={["id:1", "id:2"]} />)

    tops = { "id:1": 40, "id:2": 0 }
    rerender(<Table rowIds={["id:2", "id:1"]} />)

    expect(animateCalls).toHaveLength(0)
  })
})
