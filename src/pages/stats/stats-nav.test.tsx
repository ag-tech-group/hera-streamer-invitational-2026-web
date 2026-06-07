import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { StatsJumpSelect, StatsRail } from "@/pages/stats/stats-nav"
import { SECTION_IDS } from "@/pages/stats/stats-sections"

// The nav label for each section, in render order (reuses the section headings).
const SECTION_LABELS = [
  "Overview",
  "Team combined peak elo",
  "Peak elo race",
  "Team average peak elo",
  "Current elo over time",
  "Position over time",
  "Civilizations",
  "Civs by team",
  "Head-to-head",
]

describe("StatsRail", () => {
  it("renders every section as a jump button under a labelled nav", () => {
    render(<StatsRail activeId={SECTION_IDS.overview} onJump={vi.fn()} />)
    expect(
      screen.getByRole("navigation", { name: "On this page" })
    ).toBeInTheDocument()
    for (const label of SECTION_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("marks only the active section with aria-current", () => {
    render(<StatsRail activeId={SECTION_IDS.eloRace} onJump={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: "Peak elo race" })
    ).toHaveAttribute("aria-current", "location")
    expect(
      screen.getByRole("button", { name: "Overview" })
    ).not.toHaveAttribute("aria-current")
  })

  it("calls onJump with the section id and 'rail' source on click", async () => {
    const user = userEvent.setup()
    const onJump = vi.fn()
    render(<StatsRail activeId={SECTION_IDS.overview} onJump={onJump} />)
    await user.click(screen.getByRole("button", { name: "Civilizations" }))
    expect(onJump).toHaveBeenCalledWith(SECTION_IDS.civilizations, "rail")
  })
})

describe("StatsJumpSelect", () => {
  it("renders a labelled jump-to combobox", () => {
    render(<StatsJumpSelect activeId={SECTION_IDS.overview} onJump={vi.fn()} />)
    expect(
      screen.getByRole("combobox", { name: "Jump to section" })
    ).toBeInTheDocument()
  })
})
