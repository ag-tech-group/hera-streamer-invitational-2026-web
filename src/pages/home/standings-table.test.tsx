import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StandingsTable } from "@/pages/home/standings-table"
import type { StandingsRow } from "@/types"

/** Builds a `StandingsRow`, requiring only the fields a test cares about. */
function row(
  overrides: Partial<StandingsRow> & Pick<StandingsRow, "profileId" | "alias">
): StandingsRow {
  return {
    country: null,
    currentRating: 2500,
    maxRating: 2600,
    wins: 100,
    losses: 50,
    streak: 0,
    recentResults: [],
    gamesPlayed: 0,
    rank: 1,
    rankTotal: 50000,
    inMatch: false,
    lastMatchAt: null,
    updatedAt: "2026-05-21T00:00:00Z",
    ...overrides,
  }
}

// Generic placeholder rows in standings order (rating descending). The ladder
// `rank` values are deliberately not 1/2/3 — so a passing test proves the
// Position column shows the row's place here, not the global ladder rank.
const rows: StandingsRow[] = [
  row({ profileId: 1, alias: "Alpha", currentRating: 2800, rank: 7 }),
  row({ profileId: 2, alias: "Bravo", currentRating: 2700, rank: 2 }),
  row({ profileId: 3, alias: "Charlie", currentRating: 2600, rank: 15 }),
]

describe("StandingsTable", () => {
  it("shows Position and Ladder column headers", () => {
    render(<StandingsTable rows={rows} />)
    expect(
      screen.getByRole("columnheader", { name: "Position" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Ladder" })
    ).toBeInTheDocument()
  })

  it("numbers rows by tournament position, distinct from ladder rank", () => {
    render(<StandingsTable rows={rows} />)
    const bodyRows = screen.getAllByRole("row").slice(1) // drop the header row

    const positions = bodyRows.map(
      (r) => within(r).getAllByRole("cell")[0].textContent
    )
    const ladders = bodyRows.map(
      (r) => within(r).getAllByRole("cell")[1].textContent
    )

    expect(positions).toEqual(["1", "2", "3"])
    expect(ladders).toEqual(["7", "2", "15"])
  })

  it("shows the Games and Recent column headers", () => {
    render(<StandingsTable rows={rows} />)
    expect(
      screen.getByRole("columnheader", { name: "Games" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Recent" })
    ).toBeInTheDocument()
  })
})

describe("StandingsTable — recent results", () => {
  it("renders a pip per recent match, titled by win or loss", () => {
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            recentResults: ["win", "loss", "win"],
          }),
        ]}
      />
    )
    expect(screen.getAllByTitle("Win")).toHaveLength(2)
    expect(screen.getAllByTitle("Loss")).toHaveLength(1)
  })

  it("shows a placeholder when a player has no recent matches", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", recentResults: [] })]}
      />
    )
    expect(screen.queryByTitle("Win")).not.toBeInTheDocument()
    expect(screen.queryByTitle("Loss")).not.toBeInTheDocument()
  })
})

describe("StandingsTable — in-match indicator", () => {
  it("marks a player who is in a live match", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", inMatch: true })]}
      />
    )
    expect(screen.getByText("Live")).toBeInTheDocument()
  })

  it("leaves a player who is not in a live match unmarked", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", inMatch: false })]}
      />
    )
    expect(screen.queryByText("Live")).not.toBeInTheDocument()
  })
})

describe("StandingsTable — games played", () => {
  it("shows each player's tournament games-played count", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", gamesPlayed: 14 })]}
      />
    )
    // Games is the 7th column: Position, Ladder, Player, Rating, Peak,
    // Streak, Games, Recent, Activity.
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells[6]).toHaveTextContent("14")
  })
})
