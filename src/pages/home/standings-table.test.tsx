import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { StandingsTable } from "@/pages/home/standings-table"
import type { StandingsRow } from "@/types"

/** Builds a `StandingsRow`, requiring only the fields a test cares about. */
function row(
  overrides: Partial<StandingsRow> & Pick<StandingsRow, "profileId" | "alias">
): StandingsRow {
  return {
    country: null,
    team: null,
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
    presentation: {},
    streamLive: false,
    ...overrides,
  }
}

// Generic rows whose default `maxRating` ties, so the peak-rank tiebreak
// (current rating descending) sets their 1/2/3 Position order. The `rank`
// values are deliberately not 1/2/3 — Position comes from peak rating, not the
// (no-longer-displayed) ladder rank, as the tests below prove.
const rows: StandingsRow[] = [
  row({ profileId: 1, alias: "Alpha", currentRating: 2800, rank: 7 }),
  row({ profileId: 2, alias: "Bravo", currentRating: 2700, rank: 2 }),
  row({ profileId: 3, alias: "Charlie", currentRating: 2600, rank: 15 }),
]

describe("StandingsTable", () => {
  it("shows Position and Team column headers", () => {
    render(<StandingsTable rows={rows} tournamentStarted />)
    expect(
      screen.getByRole("columnheader", { name: "Position" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Team" })
    ).toBeInTheDocument()
  })

  it("numbers rows by tournament position from peak rating, not ladder rank", () => {
    render(<StandingsTable rows={rows} tournamentStarted />)
    const bodyRows = screen.getAllByRole("row").slice(1) // drop the header row

    const positions = bodyRows.map(
      (r) => within(r).getAllByRole("cell")[0].textContent
    )

    // Rows carry non-1/2/3 `rank` values; Position still reads 1/2/3 from the
    // peak-rating order, proving it isn't derived from the (now-unshown)
    // ladder rank.
    expect(positions).toEqual(["1", "2", "3"])
  })

  it("ranks tournament position by peak rating, not current rating", () => {
    // Bravo has the higher *current* rating, but Alpha's higher *peak* (max)
    // rating takes position 1 (#197).
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            currentRating: 2500,
            maxRating: 2900,
          }),
          row({
            profileId: 2,
            alias: "Bravo",
            currentRating: 2700,
            maxRating: 2750,
          }),
        ]}
        tournamentStarted
      />
    )
    const bodyRows = screen.getAllByRole("row").slice(1)
    expect(bodyRows[0]).toHaveTextContent("Alpha")
    expect(within(bodyRows[0]).getAllByRole("cell")[0]).toHaveTextContent("1")
    expect(bodyRows[1]).toHaveTextContent("Bravo")
  })

  it("shows peak rating in the headline column, current rating beside it", () => {
    // Columns after #197: Position, Team, Player, Peak, Rating, …
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            currentRating: 2500,
            maxRating: 2900,
          }),
        ]}
        tournamentStarted
      />
    )
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells[3]).toHaveTextContent("2900") // Peak (headline)
    expect(cells[4]).toHaveTextContent("2500") // current Rating (secondary)
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

describe("StandingsTable — team column", () => {
  it("shows the team initials as a chip with the full name on hover", () => {
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            team: { teamId: 3, name: "Team Grubby", initials: "G" },
          }),
        ]}
        tournamentStarted
      />
    )
    const chip = screen.getByTitle("Team Grubby")
    expect(chip).toHaveTextContent("G")
  })

  it("shows a placeholder in the Team cell when the player has no team", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", team: null })]}
        tournamentStarted
      />
    )
    // Team is the 2nd column (Position, Team, Player, ...).
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells[1]).toHaveTextContent("—")
  })

  it("colours the chip blue for odd team ids and red for even", () => {
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            team: { teamId: 1, name: "Blue", initials: "B" },
          }),
          row({
            profileId: 2,
            alias: "Bravo",
            team: { teamId: 2, name: "Red", initials: "R" },
          }),
        ]}
        tournamentStarted
      />
    )
    expect(screen.getByTitle("Blue")).toHaveAttribute("data-team-color", "p1")
    expect(screen.getByTitle("Red")).toHaveAttribute("data-team-color", "p2")
  })

  it("groups rows by team when the Team header is sorted", async () => {
    const user = userEvent.setup()
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            currentRating: 2800,
            team: { teamId: 2, name: "Red", initials: "R" },
          }),
          row({
            profileId: 2,
            alias: "Bravo",
            currentRating: 2700,
            team: { teamId: 1, name: "Blue", initials: "B" },
          }),
          row({
            profileId: 3,
            alias: "Charlie",
            currentRating: 2600,
            team: { teamId: 2, name: "Red", initials: "R" },
          }),
        ]}
        tournamentStarted
      />
    )
    await user.click(screen.getByRole("button", { name: "Team" }))
    const teamCells = screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[1].textContent)
    // Ascending by initials groups Blue (team 1) ahead of Red (team 2).
    expect(teamCells).toEqual(["B", "R", "R"])
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
    // Games is the 7th column: Position, Team, Player, Peak, Rating,
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

describe("StandingsTable — player name link", () => {
  it("links the name to the host-supplied profile URL in a new tab", () => {
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1819870,
            alias: "Alpha",
            presentation: {
              profileUrl: "https://www.aoe2insights.com/user/12449433/",
            },
          }),
        ]}
        tournamentStarted
      />
    )
    const link = screen.getByRole("link", { name: /alpha/i })
    expect(link).toHaveAttribute(
      "href",
      "https://www.aoe2insights.com/user/12449433/"
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders the name as plain text when no profile URL is set", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1819870, alias: "Alpha", presentation: {} })]}
        tournamentStarted
      />
    )
    expect(screen.queryByRole("link", { name: /alpha/i })).toBeNull()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
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

describe("StandingsTable — player bio", () => {
  it("renders the bio affordance only for players with a bio in the bag", () => {
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            presentation: { bio: "Two-time champion." },
          }),
          row({ profileId: 2, alias: "Bravo" }),
        ]}
        tournamentStarted
      />
    )
    // In jsdom `(hover: hover)` is false, so BioHint renders its touch
    // affordance — an info button labelled "About {name}" beside the name.
    // Present for Alpha, absent for Bravo (empty presentation bag).
    expect(
      screen.getByRole("button", { name: "About Alpha" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "About Bravo" })
    ).not.toBeInTheDocument()
  })
})
