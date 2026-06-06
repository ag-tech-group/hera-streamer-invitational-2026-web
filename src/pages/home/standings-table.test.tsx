import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AnalyticsProvider, type AnalyticsBackend } from "@/lib/analytics"
import { StandingsTable } from "@/pages/home/standings-table"
import type { RecentMatchup, StandingsRow } from "@/types"

/** Builds a `StandingsRow`, requiring only the fields a test cares about. */
function row(
  overrides: Partial<StandingsRow> & Pick<StandingsRow, "profileId" | "alias">
): StandingsRow {
  return {
    // Default the stable id to profileId so each test row has a unique key;
    // tests override it when it matters.
    tournamentPlayerId: overrides.profileId ?? 0,
    // Default `name` (the unified display label, #187) to the alias so display
    // and name-sort match what the tests assert; overridden where it matters.
    name: overrides.alias,
    country: null,
    team: null,
    currentRating: 2500,
    maxRating: 2600,
    wins: 100,
    losses: 50,
    // Default consistent with 100W / 50L; the API computes win_pct, so the
    // fixture carries it directly rather than deriving it.
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

/** Builds a UI `RecentMatchup`, requiring only the fields a test asserts. */
function matchup(overrides: Partial<RecentMatchup> = {}): RecentMatchup {
  return {
    outcome: "win",
    civName: "Franks",
    civEmblemUrl: "/civ-emblems/franks.webp",
    opponentCivName: "Mayans",
    opponentCivEmblemUrl: "/civ-emblems/mayans.webp",
    mapName: "Arabia",
    completedAt: "2026-05-30T12:00:00Z",
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
    render(<StandingsTable rows={rows} />)
    expect(
      screen.getByRole("columnheader", { name: "Position" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Team" })
    ).toBeInTheDocument()
  })

  it("numbers rows by tournament position from peak rating, not ladder rank", () => {
    render(<StandingsTable rows={rows} />)
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
      />
    )
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells[3]).toHaveTextContent("2900") // Peak (headline)
    expect(cells[4]).toHaveTextContent("2500") // current Rating (secondary)
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
      />
    )
    const chip = screen.getByTitle("Team Grubby")
    expect(chip).toHaveTextContent("G")
  })

  it("shows a placeholder in the Team cell when the player has no team", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", team: null })]}
      />
    )
    // Team is the 2nd column (Position, Team, Player, ...).
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells[1]).toHaveTextContent("—")
  })

  it("colours the team chip by creation order, matching the Teams tab (#231)", () => {
    // Team ids 3 and 8 (earlier teams deleted): colour follows ordinal
    // position, not the raw id, so the first-created (id 3) is blue and the
    // later one (id 8) is red — no green from the gap.
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            team: { teamId: 3, name: "Blue", initials: "B" },
          }),
          row({
            profileId: 2,
            alias: "Bravo",
            team: { teamId: 8, name: "Red", initials: "R" },
          }),
        ]}
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

describe("StandingsTable — recent matchups (#339)", () => {
  it("labels each recent-game pip with its W/L + civ matchup", () => {
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            recentMatchups: [
              matchup({
                outcome: "win",
                civName: "Franks",
                opponentCivName: "Mayans",
              }),
              matchup({
                outcome: "loss",
                civName: "Goths",
                opponentCivName: "Huns",
              }),
            ],
          }),
        ]}
      />
    )
    // jsdom reports no hover capability, so the touch (Popover) branch renders
    // each pip as a labelled button — the accessible name carries the matchup.
    expect(
      screen.getByRole("button", { name: "Won as Franks vs Mayans" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Lost as Goths vs Huns" })
    ).toBeInTheDocument()
  })

  it("falls back to the player civ alone when the opponent civ is unknown", () => {
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            recentMatchups: [
              matchup({
                outcome: "win",
                civName: "Franks",
                opponentCivName: null,
                opponentCivEmblemUrl: null,
              }),
            ],
          }),
        ]}
      />
    )
    expect(
      screen.getByRole("button", { name: "Won as Franks" })
    ).toBeInTheDocument()
  })

  it("shows a placeholder when a player has no recent games", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", recentMatchups: [] })]}
      />
    )
    expect(screen.queryByRole("button", { name: /Won|Lost/ })).toBeNull()
  })

  it("opens the civ-matchup card on tap, showing both civs and the map", async () => {
    const user = userEvent.setup()
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Alpha",
            recentMatchups: [
              matchup({
                civName: "Franks",
                opponentCivName: "Mayans",
                mapName: "Arabia",
              }),
            ],
          }),
        ]}
      />
    )
    await user.click(
      screen.getByRole("button", { name: "Won as Franks vs Mayans" })
    )
    // The portaled popover surfaces both civ names and the map context line
    // (the at-a-glance row only shows the pip glyph).
    expect(await screen.findByText("Mayans")).toBeInTheDocument()
    expect(screen.getByText("Franks")).toBeInTheDocument()
    expect(screen.getByText(/Arabia/)).toBeInTheDocument()
    // The "Player" / "Opponent" captions disambiguate the two civs. Assert the
    // unambiguous one — "Player" also names a column header, but nothing else
    // says "Opponent".
    expect(screen.getByText("Opponent")).toBeInTheDocument()
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

describe("StandingsTable — live stream category & title (#328)", () => {
  // A live streamer on a single Twitch channel; each test tweaks title/category.
  function liveRow(overrides: Partial<StandingsRow> = {}): StandingsRow {
    return row({
      profileId: 1,
      alias: "Streamer",
      streamLive: true,
      presentation: { streamUrls: ["https://twitch.tv/streamer"] },
      ...overrides,
    })
  }

  it("paints the dot and icon brand-blue when the stream is on AoE2", () => {
    render(
      <StandingsTable
        rows={[liveRow({ streamCategory: "Age of Empires II" })]}
      />
    )
    const dot = screen.getByRole("img", { name: "Streaming Age of Empires II" })
    expect(dot.querySelector("span")).toHaveClass("bg-brand")
    expect(screen.getByRole("link", { name: "Watch on Twitch" })).toHaveClass(
      "text-brand"
    )
  })

  it("switches the dot and icon to white for a confirmed off-game category", () => {
    render(
      <StandingsTable rows={[liveRow({ streamCategory: "Path of Exile 2" })]} />
    )
    const dot = screen.getByRole("img", { name: "Streaming Path of Exile 2" })
    expect(dot.querySelector("span")).toHaveClass("bg-foreground")
    expect(dot.querySelector("span")).not.toHaveClass("bg-brand")
    const link = screen.getByRole("link", { name: "Watch on Twitch" })
    expect(link).toHaveClass("text-foreground")
    expect(link).not.toHaveClass("text-brand")
    // The white icon brightens in place on hover — it must never flash
    // brand-blue (the old blanket hover:text-brand).
    expect(link).not.toHaveClass("hover:text-brand")
    expect(link).toHaveClass("hover:brightness-125")
  })

  it("keeps brand-blue when live with no category (don't punish YouTube)", () => {
    render(
      <StandingsTable
        rows={[
          liveRow({
            streamCategory: null,
            presentation: { streamUrls: ["https://youtube.com/@streamer"] },
          }),
        ]}
      />
    )
    const dot = screen.getByRole("img", { name: "Streaming live" })
    expect(dot.querySelector("span")).toHaveClass("bg-brand")
    expect(screen.getByRole("link", { name: "Watch on YouTube" })).toHaveClass(
      "text-brand"
    )
  })

  it("names the watch links by their action, not the churning stream title", () => {
    // The title/category live in a lazy, portaled hover card (and tests run the
    // touch path → bare link), so — like the other HoverCard tooltips — we
    // assert the trigger links are intact and named by their action.
    render(
      <StandingsTable
        rows={[
          liveRow({
            streamTitle: "RANKED 1v1 — !sub",
            streamCategory: "Age of Empires II",
            presentation: {
              streamUrls: [
                "https://twitch.tv/streamer",
                "https://youtube.com/@streamer",
              ],
            },
          }),
        ]}
      />
    )
    expect(
      screen.getByRole("link", { name: "Watch on Twitch" })
    ).toHaveAttribute("href", "https://twitch.tv/streamer")
    expect(
      screen.getByRole("link", { name: "Watch on YouTube" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /RANKED 1v1/ })
    ).not.toBeInTheDocument()
  })

  it("shows no dot and a muted icon when offline", () => {
    render(
      <StandingsTable
        rows={[
          row({
            profileId: 1,
            alias: "Offline",
            streamLive: false,
            // Stale title/category are ignored offline — the whole treatment
            // keys off streamLive.
            streamTitle: "stale title",
            streamCategory: "Age of Empires II",
            presentation: { streamUrls: ["https://twitch.tv/offline"] },
          }),
        ]}
      />
    )
    expect(
      screen.queryByRole("img", { name: /Streaming/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Watch on Twitch" })).toHaveClass(
      "text-muted-foreground"
    )
  })
})

describe("StandingsTable — games played", () => {
  it("shows each player's tournament games-played count", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", gamesPlayed: 14 })]}
      />
    )
    // Games is the 6th column (index 5): Position, Team, Player, Peak,
    // Rating, Games, Win%, Recent, Streak, Last match, Watch. (Streak moved
    // to follow Recent; Win% was inserted right after Games.)
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells[5]).toHaveTextContent("14")
  })
})

describe("StandingsTable — podium position chips", () => {
  it("renders position 1 as a filled brand chip", () => {
    render(<StandingsTable rows={rows} />)
    const bodyRows = screen.getAllByRole("row").slice(1)
    const firstPos = within(bodyRows[0]).getAllByRole("cell")[0]
    expect(firstPos.querySelector("span")).toHaveClass("bg-brand")
  })

  it("renders positions 2 and 3 with descending brand-fill intensity", () => {
    render(<StandingsTable rows={rows} />)
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
    render(<StandingsTable rows={fourRows} />)
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
    render(<StandingsTable rows={rows} />)
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
      />
    )
    expect(screen.queryByRole("link", { name: /alpha/i })).toBeNull()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })
})

describe("StandingsTable — full column set", () => {
  it("always renders the Games, Win %, and Recent column headers", () => {
    render(<StandingsTable rows={rows} />)
    expect(
      screen.getByRole("columnheader", { name: "Games" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Win %" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Recent" })
    ).toBeInTheDocument()
  })

  it("renders each player's games-played count", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", gamesPlayed: 14 })]}
      />
    )
    expect(screen.getByText("14")).toBeInTheDocument()
  })
})

describe("StandingsTable — rating cell", () => {
  it("renders the rating directly on first paint (count-up snaps on mount)", () => {
    render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", currentRating: 1850 })]}
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
      />
    )
    expect(screen.getByTitle("CA")).toHaveClass("fi", "fi-ca")
  })

  it("falls back to a generic icon when a player has no country", () => {
    const { container } = render(
      <StandingsTable
        rows={[row({ profileId: 1, alias: "Alpha", country: null })]}
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

describe("StandingsTable — analytics (#215)", () => {
  function renderWithAnalytics(rows: StandingsRow[]) {
    const track = vi.fn()
    const backend: AnalyticsBackend = {
      track,
      identify: vi.fn(),
      page: vi.fn(),
    }
    render(
      <AnalyticsProvider backend={backend}>
        <StandingsTable rows={rows} />
      </AnalyticsProvider>
    )
    return track
  }

  it("fires watch.click with platform + stream state on a Watch link", async () => {
    const user = userEvent.setup()
    const track = renderWithAnalytics([
      row({
        profileId: 42,
        alias: "Streamer",
        streamLive: true,
        presentation: { streamUrls: ["https://twitch.tv/streamer"] },
      }),
    ])
    await user.click(screen.getByRole("link", { name: "Watch on Twitch" }))
    expect(track).toHaveBeenCalledWith("watch.click", {
      profileId: 42,
      alias: "Streamer",
      platform: "twitch",
      streamLive: true,
      source: "standings",
    })
  })

  it("fires player.profile.click when the name link is clicked", async () => {
    const user = userEvent.setup()
    const track = renderWithAnalytics([
      row({
        profileId: 7,
        alias: "Linked",
        presentation: { profileUrl: "https://www.aoe2insights.com" },
      }),
    ])
    await user.click(screen.getByRole("link", { name: "Linked" }))
    expect(track).toHaveBeenCalledWith("player.profile.click", {
      profileId: 7,
      alias: "Linked",
      source: "standings",
    })
  })

  it("fires player.bio.open once when the bio affordance is opened", async () => {
    const user = userEvent.setup()
    const track = renderWithAnalytics([
      row({
        profileId: 9,
        alias: "Storied",
        presentation: { bio: "Two-time champion." },
      }),
    ])
    // jsdom reports no hover capability, so the touch info button is rendered.
    await user.click(screen.getByRole("button", { name: "About Storied" }))
    const bioOpens = track.mock.calls.filter((c) => c[0] === "player.bio.open")
    expect(bioOpens).toHaveLength(1)
    expect(bioOpens[0][1]).toEqual({
      profileId: 9,
      alias: "Storied",
      source: "standings",
    })
  })
})
