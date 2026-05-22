import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TeamsTable } from "@/pages/home/teams-table"
import type { TeamStandingsRow } from "@/types"

/** Builds a `TeamStandingsRow`, requiring only the fields a test cares about. */
function teamRow(
  overrides: Partial<TeamStandingsRow> &
    Pick<TeamStandingsRow, "teamId" | "name">
): TeamStandingsRow {
  return {
    initials: "TM",
    combinedRatingSum: 5000,
    combinedRatingAverage: 2500,
    members: [],
    ...overrides,
  }
}

const rows: TeamStandingsRow[] = [
  teamRow({
    teamId: 1,
    name: "Team Alpha",
    initials: "ALP",
    combinedRatingSum: 5400,
  }),
  teamRow({
    teamId: 2,
    name: "Team Bravo",
    initials: "BRV",
    combinedRatingSum: 5100,
  }),
]

describe("TeamsTable", () => {
  it("shows the team standings column headers", () => {
    render(<TeamsTable rows={rows} />)
    expect(
      screen.getByRole("columnheader", { name: "Team" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Combined" })
    ).toBeInTheDocument()
  })

  it("renders each team's initials, name, and combined rating", () => {
    render(<TeamsTable rows={rows} />)
    expect(screen.getByText("Team Alpha")).toBeInTheDocument()
    expect(screen.getByText("ALP")).toBeInTheDocument()
    expect(screen.getByText("5400")).toBeInTheDocument()
  })

  it("numbers teams by their position in the standings", () => {
    render(<TeamsTable rows={rows} />)
    const bodyRows = screen.getAllByRole("row").slice(1) // drop the header row
    const positions = bodyRows.map(
      (r) => within(r).getAllByRole("cell")[0].textContent
    )
    expect(positions).toEqual(["1", "2"])
  })

  it("lists each team's members with their ratings", () => {
    render(
      <TeamsTable
        rows={[
          teamRow({
            teamId: 1,
            name: "Team Alpha",
            members: [
              { profileId: 10, alias: "PlayerX", currentRating: 2700 },
              { profileId: 11, alias: "PlayerY", currentRating: 2600 },
            ],
          }),
        ]}
      />
    )
    // Members is the 5th column: Position, Team, Combined, Avg, Members.
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells[4]).toHaveTextContent("PlayerX")
    expect(cells[4]).toHaveTextContent("2700")
    expect(cells[4]).toHaveTextContent("PlayerY")
  })

  it("rounds the average rating for display", () => {
    render(
      <TeamsTable
        rows={[
          teamRow({
            teamId: 1,
            name: "Team Alpha",
            combinedRatingAverage: 2549.6,
          }),
        ]}
      />
    )
    expect(screen.getByText("2550")).toBeInTheDocument()
  })
})
