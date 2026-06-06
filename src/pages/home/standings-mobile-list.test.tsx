import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { SortState } from "@/hooks/use-table-sort"
import { teamColorMap } from "@/lib/team-colors"
import { StandingsMobileList } from "@/pages/home/standings-mobile-list"
import type { StandingsRow } from "@/types"

/** Builds a `StandingsRow`, requiring only the fields a test cares about. */
function row(
  overrides: Partial<StandingsRow> & Pick<StandingsRow, "profileId" | "alias">
): StandingsRow {
  return {
    tournamentPlayerId: overrides.profileId ?? 0,
    name: overrides.alias,
    country: null,
    team: null,
    currentRating: 2500,
    maxRating: 2600,
    wins: 100,
    losses: 50,
    winPct: 66.7,
    streak: 0,
    longestWinStreak: 0,
    recentMatchups: [],
    gamesPlayed: 0,
    rank: 1,
    rankTotal: 50000,
    inMatch: false,
    lastMatchAt: null,
    updatedAt: "2026-05-21T00:00:00Z",
    presentation: {},
    streamLive: false,
    streamTitle: null,
    streamCategory: null,
    ...overrides,
  }
}

const NOW = new Date("2026-05-30T12:00:00Z")

/**
 * Renders the mobile list as `StandingsTable` would: it hands down rows already
 * sorted, plus the peak-rank position map and the team-colour map. Tests pass
 * `rows` in the order they should display and the `sortState` that the (shared)
 * sort would currently hold.
 */
function renderList(rows: StandingsRow[], sortState: SortState | null) {
  const positionMap = new Map<string, number>()
  rows.forEach((r, i) => positionMap.set(String(r.tournamentPlayerId), i + 1))
  const colorByTeamId = teamColorMap(
    rows.flatMap((r) => (r.team ? [r.team.teamId] : []))
  )
  return render(
    <StandingsMobileList
      rows={rows}
      sortState={sortState}
      positionMap={positionMap}
      colorByTeamId={colorByTeamId}
      now={NOW}
    />
  )
}

const rows: StandingsRow[] = [
  row({
    profileId: 1,
    alias: "Alpha",
    maxRating: 2600,
    winPct: 66.7,
    gamesPlayed: 10,
  }),
  row({
    profileId: 2,
    alias: "Bravo",
    maxRating: 2500,
    winPct: 50.0,
    gamesPlayed: 8,
  }),
  row({
    profileId: 3,
    alias: "Charlie",
    maxRating: 2400,
    winPct: 75.0,
    gamesPlayed: 12,
  }),
]

describe("StandingsMobileList", () => {
  it("renders one slim row per player with rank, name, and the default Peak metric", () => {
    renderList(rows, null)
    // One collapsed trigger button per row (panels are unmounted when closed).
    expect(screen.getAllByRole("button")).toHaveLength(3)
    // Each collapsed row echoes the Peak label (the default metric) + its value.
    expect(screen.getAllByText("Peak")).toHaveLength(3)
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveTextContent(
      "2600"
    )
  })

  it("swaps the metric column to whatever the list is sorted by", () => {
    renderList(rows, { key: "winPct", direction: "desc" })
    // Metric label follows the sort; Peak no longer shows in the collapsed rows.
    expect(screen.getAllByText("Win %")).toHaveLength(3)
    expect(screen.queryByText("Peak")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveTextContent(
      "66.7%"
    )
  })

  it("shows Peak (not the name) in the metric column when sorted by player", () => {
    renderList(rows, { key: "alias", direction: "asc" })
    expect(screen.getAllByText("Peak")).toHaveLength(3)
  })

  it("expands a row to reveal the full stat panel, and collapses it again", async () => {
    const user = userEvent.setup()
    renderList(rows, null)
    const alpha = screen.getByRole("button", { name: /Alpha/ })
    // Games lives only in the expanded panel (the metric column shows Peak).
    expect(screen.queryByText("Games")).not.toBeInTheDocument()
    expect(alpha).toHaveAttribute("aria-expanded", "false")

    await user.click(alpha)
    expect(alpha).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Games")).toBeInTheDocument()

    await user.click(alpha)
    expect(alpha).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Games")).not.toBeInTheDocument()
  })

  it("is a multi-open accordion — opening one row leaves the others open", async () => {
    const user = userEvent.setup()
    renderList(rows, null)
    await user.click(screen.getByRole("button", { name: /Alpha/ }))
    await user.click(screen.getByRole("button", { name: /Bravo/ }))
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(screen.getByRole("button", { name: /Bravo/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    // Both panels are open at once, so the panel-only "Games" row appears twice.
    expect(screen.getAllByText("Games")).toHaveLength(2)
  })

  it("links the player name through to their profile in the expanded panel", async () => {
    const user = userEvent.setup()
    renderList(
      [
        row({
          profileId: 1,
          alias: "Alpha",
          presentation: { profileUrl: "https://example.com/alpha" },
        }),
      ],
      null
    )
    // The slim row (one big expand button) can't hold a link, so the tappable
    // profile link lives in the panel — the reason the panel re-renders the name.
    await user.click(screen.getByRole("button", { name: /Alpha/ }))
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "https://example.com/alpha"
    )
  })

  it("suffixes a live streamer's name with a brand dot when on AoE2", () => {
    renderList(
      [
        row({
          profileId: 1,
          alias: "Alpha",
          streamLive: true,
          streamCategory: "Age of Empires II",
        }),
      ],
      null
    )
    const dot = screen.getByRole("img", { name: "Streaming Age of Empires II" })
    expect(dot.querySelector(".bg-brand")).not.toBeNull()
  })

  it("colours the live dot white for a confirmed off-game stream (matching the Watch tier)", () => {
    renderList(
      [
        row({
          profileId: 1,
          alias: "Alpha",
          streamLive: true,
          streamCategory: "Just Chatting",
        }),
      ],
      null
    )
    const dot = screen.getByRole("img", { name: "Streaming Just Chatting" })
    expect(dot.querySelector(".bg-foreground")).not.toBeNull()
    expect(dot.querySelector(".bg-brand")).toBeNull()
  })

  it("shows the live dot once (on the name, not in the metric) when sorted by watch", () => {
    renderList(
      [
        row({
          profileId: 1,
          alias: "Alpha",
          streamLive: true,
          streamCategory: "Age of Empires II",
          presentation: { streamUrls: ["https://twitch.tv/x"] },
        }),
      ],
      { key: "watch", direction: "desc" }
    )
    expect(screen.getAllByRole("img", { name: /Streaming/ })).toHaveLength(1)
  })
})
