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
    isCaptain: false,
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
    // Headline is the combined-rating SUM (#242), thousands-formatted; the
    // player-count tagline follows. Both teams have 2 players, so the count
    // string appears twice — once per panel.
    expect(screen.getByText("5,400")).toBeInTheDocument()
    expect(screen.getAllByText("2 players")).toHaveLength(2)
  })

  it("displays panels in rank order (API order) and labels their position", () => {
    // Reverse the input so Team Bravo is ranked first — panels follow the
    // API rank order (#230), so Bravo's panel renders before Alpha's.
    render(<TeamsView rows={[rows[1], rows[0]]} />)
    const headings = screen.getAllByRole("heading", { level: 2 })
    expect(headings[0]).toHaveTextContent("Team Bravo")
    expect(headings[1]).toHaveTextContent("Team Alpha")
    expect(
      screen.getByLabelText("Rank #1 by combined rating")
    ).toHaveTextContent("#1")
    expect(
      screen.getByLabelText("Rank #2 by combined rating")
    ).toHaveTextContent("#2")
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

  it("colours by creation order, pinned to team identity regardless of display order (#231)", () => {
    // Input reversed (Bravo ranked first), but colour follows creation order
    // (teamId ascending): Alpha (id 1) stays blue, Bravo (id 2) stays red —
    // even though Bravo's panel now renders first. A live rank flip reorders
    // panels without recolouring them.
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

  it("colours the first-created team blue even when its id has a gap (#231)", () => {
    // Teams with ids 3 and 8 (earlier teams deleted): the lower id is still
    // the first-created, so it's blue — the raw id value doesn't pick green.
    render(
      <TeamsView
        rows={[
          teamRow({ teamId: 8, name: "Later Team" }),
          teamRow({ teamId: 3, name: "First Team" }),
        ]}
      />
    )
    const first = screen
      .getByRole("heading", { name: "First Team" })
      .closest("[data-team-color]")
    expect(first).toHaveAttribute("data-team-color", "p1")
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

  it("renders a Captain badge next to the captain, and none otherwise (#235)", () => {
    render(
      <TeamsView
        rows={[
          teamRow({
            teamId: 1,
            name: "Has Captain",
            members: [
              member({
                profileId: 50,
                alias: "Cap",
                currentRating: 2000,
                isCaptain: true,
              }),
              member({ profileId: 51, alias: "Regular", currentRating: 1900 }),
            ],
          }),
          teamRow({
            teamId: 2,
            name: "No Captain",
            members: [
              member({ profileId: 60, alias: "Nobody", currentRating: 1850 }),
            ],
          }),
        ]}
      />
    )
    // Exactly one Captain badge across both teams — the captain's.
    const badges = screen.getAllByText("Captain")
    expect(badges).toHaveLength(1)
    // It sits in the captain's pill (same row as their alias).
    const capPill = screen.getByText("Cap").closest("div")
    expect(within(capPill!).getByText("Captain")).toBeInTheDocument()
  })
})
