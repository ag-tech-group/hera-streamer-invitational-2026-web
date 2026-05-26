import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TeamsView } from "@/pages/home/teams-view"
import type { TeamMember, TeamStandingsRow } from "@/types"

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

/**
 * Builds a `TeamMember` with sensible inert defaults — country `null`,
 * not in a match — so each test only spells out the fields it cares
 * about.
 */
function member(
  overrides: Partial<TeamMember> &
    Pick<TeamMember, "profileId" | "alias" | "currentRating">
): TeamMember {
  return {
    country: null,
    inMatch: false,
    liveMatchId: null,
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
      member({ profileId: 10, alias: "PlayerX", currentRating: 2720 }),
      member({ profileId: 11, alias: "PlayerY", currentRating: 2680 }),
    ],
  }),
  teamRow({
    teamId: 2,
    name: "Team Bravo",
    initials: "BRV",
    combinedRatingSum: 5100,
    combinedRatingAverage: 2550,
    members: [
      member({ profileId: 20, alias: "PlayerZ", currentRating: 2610 }),
      member({ profileId: 21, alias: "PlayerQ", currentRating: 2490 }),
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
            members: [
              member({ profileId: 30, alias: "Solo", currentRating: 1800 }),
            ],
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

  it("renders the country flag when one is set, falling back to a globe", () => {
    render(
      <TeamsView
        rows={[
          teamRow({
            teamId: 1,
            name: "Flagged",
            members: [
              member({
                profileId: 40,
                alias: "Flagged",
                country: "kr",
                currentRating: 2300,
              }),
              member({
                profileId: 41,
                alias: "Unflagged",
                country: null,
                currentRating: 2200,
              }),
            ],
          }),
          teamRow({ teamId: 2, name: "Other", members: [] }),
        ]}
      />
    )
    // flag-icons renders the flag as a decorative span with `fi-<code>`.
    // The pill puts the lookup code in the title attribute, so that's
    // the most stable selector for the flag node.
    expect(screen.getByTitle("KR")).toBeInTheDocument()
    // The fallback pill should still have a globe icon (the lucide
    // <Globe /> renders as an svg with class "lucide-globe").
    const unflaggedPill = screen.getByText("Unflagged").closest("div")
    expect(unflaggedPill?.querySelector("svg.lucide-globe")).not.toBeNull()
  })

  it("shows a live indicator only on members currently in a match", () => {
    render(
      <TeamsView
        rows={[
          teamRow({
            teamId: 1,
            name: "Live Team",
            members: [
              member({
                profileId: 50,
                alias: "Playing",
                currentRating: 2400,
                inMatch: true,
                liveMatchId: 999,
              }),
              member({
                profileId: 51,
                alias: "Resting",
                currentRating: 2300,
                inMatch: false,
              }),
            ],
          }),
          teamRow({ teamId: 2, name: "Other", members: [] }),
        ]}
      />
    )
    // The live dot's accessible name comes from the shared
    // `standings.liveAriaLabel` string ("In a live match"). One member
    // is live, so it appears exactly once.
    expect(screen.getAllByText(/in a live match/i)).toHaveLength(1)
  })

  it("marks a panel's accent stripe as live when any member is in a match", () => {
    const { container } = render(
      <TeamsView
        rows={[
          teamRow({
            teamId: 1,
            name: "Live Team",
            members: [
              member({
                profileId: 50,
                alias: "Playing",
                currentRating: 2400,
                inMatch: true,
                liveMatchId: 999,
              }),
              member({
                profileId: 51,
                alias: "Resting",
                currentRating: 2300,
              }),
            ],
          }),
          teamRow({
            teamId: 2,
            name: "Idle Team",
            members: [
              member({
                profileId: 60,
                alias: "Bench",
                currentRating: 2350,
              }),
            ],
          }),
        ]}
      />
    )
    // Exactly one panel — the live team's — should carry the heartbeat
    // class on its accent stripe. The idle team's accent stripe stays
    // bare so the pulse reads as "this side is live right now".
    expect(container.querySelectorAll(".team-heartbeat")).toHaveLength(1)
  })

  it("falls back to a single-column layout when not a pair", () => {
    // Only one team — no coliseum, no VS pillar.
    render(<TeamsView rows={[rows[0]]} />)
    expect(
      screen.queryByLabelText(/VS/i, { selector: "span" })
    ).not.toBeInTheDocument()
  })
})
