import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { StandingsSortBar } from "@/pages/home/standings-sort-bar"

describe("StandingsSortBar", () => {
  it("renders a labelled sort group with a field picker and a direction toggle", () => {
    render(<StandingsSortBar sortState={null} setSort={vi.fn()} />)
    expect(screen.getByRole("group", { name: "Sort" })).toBeInTheDocument()
    // The field picker (a combobox) and the asc/desc toggle.
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Sort direction" })
    ).toBeInTheDocument()
  })

  it("reflects the default (peak-ranked) order as descending until the user acts", () => {
    render(<StandingsSortBar sortState={null} setSort={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: "Sort direction" })
    ).toHaveTextContent("Descending")
  })

  it("toggling direction from the default materialises an explicit Peak sort", async () => {
    const user = userEvent.setup()
    const setSort = vi.fn()
    render(<StandingsSortBar sortState={null} setSort={setSort} />)
    await user.click(screen.getByRole("button", { name: "Sort direction" }))
    // Default reads as maxRating desc, so the first toggle flips it to asc.
    expect(setSort).toHaveBeenCalledWith("maxRating", "asc")
  })

  it("toggles the active sort's direction, not the field", async () => {
    const user = userEvent.setup()
    const setSort = vi.fn()
    render(
      <StandingsSortBar
        sortState={{ key: "winPct", direction: "asc" }}
        setSort={setSort}
      />
    )
    const toggle = screen.getByRole("button", { name: "Sort direction" })
    expect(toggle).toHaveTextContent("Ascending")
    await user.click(toggle)
    expect(setSort).toHaveBeenCalledWith("winPct", "desc")
  })

  it("slides away and goes inert when the list is scrolled out of view", () => {
    render(
      <StandingsSortBar sortState={null} setSort={vi.fn()} visible={false} />
    )
    // Portaled to document.body, so query the document rather than the container.
    const group = document.querySelector('[role="group"][aria-label="Sort"]')
    expect(group).toHaveAttribute("inert")
    expect(group?.className).toContain("translate-y-full")
  })
})
