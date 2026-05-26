import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TeamsView } from "@/pages/home/teams-view"
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
    combinedRatingAverage: 2700,
    members: [
      { profileId: 10, alias: "PlayerX", currentRating: 2720 },
      { profileId: 11, alias: "PlayerY", currentRating: 2680 },
    ],
  }),
  teamRow({
    teamId: 2,
    name: "Team Bravo",
    initials: "BRV",
    combinedRatingSum: 5100,
    combinedRatingAverage: 2550,
    members: [
      { profileId: 20, alias: "PlayerZ", currentRating: 2610 },
      { profileId: 21, alias: "PlayerQ", currentRating: 2490 },
    ],
  }),
]

describe("TeamsView", () => {
  it("renders each team's identity and headline stats", () => {
    render(<TeamsView rows={rows} />)
    expect(
      screen.getByRole("heading", { name: "Team Alpha", level: 2 })
    ).toBeInTheDocument()
    expect(screen.getByText("ALP")).toBeInTheDocument()
    // Headline is avg rating, rounded; player count tagline follows.
    // Both teams in the fixture have 2 players, so the player-count
    // string appears twice — once per panel.
    expect(screen.getByText("2,700")).toBeInTheDocument()
    expect(screen.getAllByText("2 players")).toHaveLength(2)
  })

  it("labels teams by their position in the standings", () => {
    // Reverse the input — Team Bravo is ranked first now — to prove
    // the rank reflects the API order rather than the stable
    // teamId-sorted display order the panels use.
    render(<TeamsView rows={[rows[1], rows[0]]} />)
    expect(screen.getByLabelText("Rank 1")).toHaveTextContent("#1")
    expect(screen.getByLabelText("Rank 2")).toHaveTextContent("#2")
  })

  it("renders every roster member with their current rating", () => {
    render(<TeamsView rows={rows} />)
    const rosters = screen.getAllByRole("list", { name: /team roster/i })
    expect(rosters).toHaveLength(2)
    expect(within(rosters[0]).getByText("PlayerX")).toBeInTheDocument()
    expect(within(rosters[0]).getByText("2720")).toBeInTheDocument()
    expect(within(rosters[1]).getByText("PlayerZ")).toBeInTheDocument()
    expect(within(rosters[1]).getByText("2610")).toBeInTheDocument()
  })

  it("assigns blue (P1) to the lower teamId and red (P2) to the higher", () => {
    // Stable colour assignment matters — otherwise a live rating change
    // that flips the ranking would also flip which side is blue.
    render(<TeamsView rows={[rows[1], rows[0]]} />)
    const alpha = screen
      .getByRole("heading", { name: "Team Alpha" })
      .closest("[data-team-color]")
    const bravo = screen
      .getByRole("heading", { name: "Team Bravo" })
      .closest("[data-team-color]")
    expect(alpha).toHaveAttribute("data-team-color", "p1")
    expect(bravo).toHaveAttribute("data-team-color", "p2")
  })

  it("shows a placeholder when a team has no rated members", () => {
    render(
      <TeamsView
        rows={[
          teamRow({ teamId: 1, name: "Empty Team", members: [] }),
          teamRow({
            teamId: 2,
            name: "Other Team",
            members: [{ profileId: 30, alias: "Solo", currentRating: 1800 }],
          }),
        ]}
      />
    )
    const empty = screen
      .getByRole("heading", { name: "Empty Team" })
      .closest<HTMLElement>("[data-team-color]")
    expect(empty).not.toBeNull()
    expect(within(empty!).getByText(/no rated members/i)).toBeInTheDocument()
  })

  it("falls back to a single-column layout when not a pair", () => {
    // Only one team — no coliseum, no VS pillar.
    render(<TeamsView rows={[rows[0]]} />)
    expect(
      screen.queryByLabelText(/VS/i, { selector: "span" })
    ).not.toBeInTheDocument()
  })
})
