import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BioHint } from "@/pages/home/bio-hint"

/**
 * Drive `useHoverCapable` by stubbing `matchMedia` to report whether the
 * combined desktop-pointer query matches. The hook only consults
 * `(hover: hover) and (pointer: fine)` (#214), so a single boolean per query
 * is enough to exercise both branches.
 */
function mockPointer({ desktop }: { desktop: boolean }) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    // The desktop branch is taken only when the combined query matches.
    matches: query.includes("pointer: fine") ? desktop : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("BioHint — touch affordance detection (#214)", () => {
  it("shows the tappable info icon when there's no fine hover pointer (a phone)", () => {
    // The real-phone failure case: a device that reports hover-capable but is
    // touch (pointer: coarse). The combined query must NOT match, so the icon
    // shows and the bio stays reachable.
    mockPointer({ desktop: false })
    render(
      <BioHint bio="Two-time champion." name="Hera">
        <span>Hera</span>
      </BioHint>
    )
    expect(
      screen.getByRole("button", { name: "About Hera" })
    ).toBeInTheDocument()
  })

  it("hides the info icon on a true mouse pointer (desktop hovers the name)", () => {
    mockPointer({ desktop: true })
    render(
      <BioHint bio="Two-time champion." name="Hera">
        <span>Hera</span>
      </BioHint>
    )
    // Desktop relies on hovering the name itself — no extra icon chrome.
    expect(
      screen.queryByRole("button", { name: "About Hera" })
    ).not.toBeInTheDocument()
  })
})
