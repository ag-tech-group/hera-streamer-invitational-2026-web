import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BackToTop } from "@/components/back-to-top"

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", { value, configurable: true })
}

afterEach(() => setScrollY(0))

describe("BackToTop", () => {
  it("stays hidden (and out of the tab order) until the page is scrolled", () => {
    render(<BackToTop />)
    // aria-hidden zeroes the accessible name, so match the sole button by role
    // (including hidden) and assert its label and state directly.
    const btn = screen.getByRole("button", { hidden: true })
    expect(btn).toHaveAttribute("aria-label", "Back to top")
    expect(btn).toHaveAttribute("aria-hidden", "true")
    expect(btn).toHaveAttribute("tabindex", "-1")
  })

  it("reveals itself after a screenful and scrolls back to top on click", async () => {
    const user = userEvent.setup()
    render(<BackToTop />)

    act(() => {
      setScrollY(window.innerHeight + 500)
      window.dispatchEvent(new Event("scroll"))
    })

    const btn = screen.getByRole("button", { name: "Back to top" })
    expect(btn).toHaveAttribute("aria-hidden", "false")

    await user.click(btn)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
  })

  it("runs the optional onActivate side-effect on click (e.g. clearing the URL hash)", async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    render(<BackToTop onActivate={onActivate} />)

    act(() => {
      setScrollY(window.innerHeight + 500)
      window.dispatchEvent(new Event("scroll"))
    })

    await user.click(screen.getByRole("button", { name: "Back to top" }))
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
  })
})
