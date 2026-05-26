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
    render(<StandingsTable rows={rows} tournamentStarted />)
    expect(
      screen.getByRole("columnheader", { name: "Position" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Ladder" })
    ).toBeInTheDocument()
  })

  it("numbers rows by tournament position, distinct from ladder rank", () => {
    render(<StandingsTable rows={rows} tournamentStarted />)
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
    render(<StandingsTable rows={rows} tournamentStarted />)
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
        tournamentStarted
      />
    )
    expect(screen.getAllByTitle("Win")).toHaveLength(2)
    expect(screen.getAllByTitle("Loss")).toHaveLength(1)
  })

  it("shows a placeholder when a player has no recent matches", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", recentResults: [] })]}
        tournamentStarted
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
        tournamentStarted
      />
    )
    expect(screen.getByText("Live")).toBeInTheDocument()
  })

  it("leaves a player who is not in a live match unmarked", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", inMatch: false })]}
        tournamentStarted
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
        tournamentStarted
      />
    )
    // Games is the 7th column: Position, Ladder, Player, Rating, Peak,
    // Streak, Games, Recent, Activity.
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells[6]).toHaveTextContent("14")
  })
})

describe("StandingsTable — podium position chips", () => {
  it("renders position 1 as a filled brand chip", () => {
    render(<StandingsTable rows={rows} tournamentStarted />)
    const bodyRows = screen.getAllByRole("row").slice(1)
    const firstPos = within(bodyRows[0]).getAllByRole("cell")[0]
    expect(firstPos.querySelector("span")).toHaveClass("bg-brand")
  })

  it("renders positions 2 and 3 with descending brand-fill intensity", () => {
    render(<StandingsTable rows={rows} tournamentStarted />)
    const bodyRows = screen.getAllByRole("row").slice(1)
    const secondPos = within(bodyRows[1]).getAllByRole("cell")[0]
    const thirdPos = within(bodyRows[2]).getAllByRole("cell")[0]
    expect(secondPos.querySelector("span")).toHaveClass("bg-brand/30")
    expect(thirdPos.querySelector("span")).toHaveClass("bg-brand/15")
  })

  it("renders positions 4+ as plain muted text (no podium chip)", () => {
    const fourRows: StandingsRow[] = [
      ...rows,
      row({ profileId: 4, alias: "Delta", currentRating: 2500, rank: 30 }),
    ]
    render(<StandingsTable rows={fourRows} tournamentStarted />)
    const bodyRows = screen.getAllByRole("row").slice(1)
    const fourthPos = within(bodyRows[3]).getAllByRole("cell")[0]
    const span = fourthPos.querySelector("span")
    expect(span).not.toHaveClass("bg-brand")
    expect(span).not.toHaveClass("bg-brand/30")
    expect(span).not.toHaveClass("bg-brand/15")
    expect(span).toHaveClass("text-muted-foreground")
  })
})

describe("StandingsTable — rank-1 row spotlight", () => {
  it("applies the spotlight class to the leader's row only", () => {
    render(<StandingsTable rows={rows} tournamentStarted />)
    const bodyRows = screen.getAllByRole("row").slice(1)
    expect(bodyRows[0]).toHaveClass("rank-1-spotlight")
    expect(bodyRows[1]).not.toHaveClass("rank-1-spotlight")
    expect(bodyRows[2]).not.toHaveClass("rank-1-spotlight")
  })
})

describe("StandingsTable — alias link", () => {
  it("links the alias to an aoe2insights search for that alias in a new tab", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1819870, alias: "Alpha" })]}
        tournamentStarted
      />
    )
    const link = screen.getByRole("link", { name: /alpha/i })
    expect(link).toHaveAttribute(
      "href",
      "https://www.aoe2insights.com/search/?q=Alpha"
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })
})

describe("StandingsTable — pre-tournament column gating", () => {
  it("hides the Games and Recent column headers when tournamentStarted is false", () => {
    render(<StandingsTable rows={rows} tournamentStarted={false} />)
    expect(
      screen.queryByRole("columnheader", { name: "Games" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: "Recent" })
    ).not.toBeInTheDocument()
    // The other columns continue to render.
    expect(
      screen.getByRole("columnheader", { name: "Rating" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Activity" })
    ).toBeInTheDocument()
  })

  it("shows the Games and Recent column headers when tournamentStarted is true", () => {
    render(<StandingsTable rows={rows} tournamentStarted />)
    expect(
      screen.getByRole("columnheader", { name: "Games" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Recent" })
    ).toBeInTheDocument()
  })

  it("drops the Games + Recent cells from each row when tournamentStarted is false", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", gamesPlayed: 14 })]}
        tournamentStarted={false}
      />
    )
    // No row should render the games count (would be in a hidden td).
    expect(screen.queryByText("14")).not.toBeInTheDocument()
  })
})

describe("StandingsTable — rating cell", () => {
  it("renders the rating directly on first paint (count-up snaps on mount)", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", currentRating: 1850 })]}
        tournamentStarted
      />
    )
    expect(screen.getByText("1850")).toBeInTheDocument()
  })
})

describe("StandingsTable — country flag", () => {
  it("renders a country flag for a player with a country", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", country: "ca" })]}
        tournamentStarted
      />
    )
    expect(screen.getByTitle("CA")).toHaveClass("fi", "fi-ca")
  })

  it("falls back to a generic icon when a player has no country", () => {
    const { container } = render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", country: null })]}
        tournamentStarted
      />
    )
    expect(container.querySelector(".fi")).not.toBeInTheDocument()
  })
})
