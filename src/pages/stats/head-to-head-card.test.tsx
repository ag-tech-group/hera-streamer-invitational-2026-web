import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AnalyticsProvider, type AnalyticsBackend } from "@/lib/analytics"
import {
  HeadToHeadCard,
  HeadToHeadMobileList,
} from "@/pages/stats/head-to-head-card"
import type { HeadToHeadGame, HeadToHeadSnapshot } from "@/types"

// The card owns its `/head-to-head` query, so the test drives the hook directly
// rather than standing up MSW + a QueryClient for each state.
const { mockUseHeadToHead } = vi.hoisted(() => ({
  mockUseHeadToHead: vi.fn(),
}))
vi.mock("@/hooks/use-head-to-head", () => ({
  useHeadToHead: mockUseHeadToHead,
}))

function game(overrides: Partial<HeadToHeadGame> = {}): HeadToHeadGame {
  return {
    matchId: 424242,
    mapName: "Arabia",
    startedAt: "2026-06-03T18:00:00Z",
    completedAt: "2026-06-03T18:23:14Z",
    durationSeconds: 1394,
    matchUrl: "https://www.aoe2insights.com/match/424242/",
    entrants: [
      {
        tournamentPlayerId: 1,
        profileId: 100,
        name: "TheViper",
        civId: 17,
        civName: "Franks",
        civEmblemUrl: "/civ-emblems/franks.webp",
        oldRating: 1834,
        newRating: 1850,
        outcome: "win",
      },
      {
        tournamentPlayerId: 2,
        profileId: 200,
        name: "Hera",
        civId: 21,
        civName: "Mayans",
        civEmblemUrl: "/civ-emblems/mayans.webp",
        oldRating: 1798,
        newRating: 1782,
        outcome: "loss",
      },
    ],
    ...overrides,
  }
}

/** A game with a controllable winner / date / length, for the sort assertions. */
function makeGame(opts: {
  matchId: number
  winner: string
  loser?: string
  startedAt: string
  durationSeconds?: number
  mapName?: string
}): HeadToHeadGame {
  return {
    matchId: opts.matchId,
    mapName: opts.mapName ?? "Arabia",
    startedAt: opts.startedAt,
    completedAt: opts.startedAt,
    durationSeconds: opts.durationSeconds ?? 1200,
    matchUrl: `https://www.aoe2insights.com/match/${opts.matchId}/`,
    entrants: [
      {
        tournamentPlayerId: opts.matchId * 10 + 1,
        profileId: opts.matchId * 10 + 1,
        name: opts.winner,
        civId: 1,
        civName: "Franks",
        civEmblemUrl: null,
        oldRating: 1800,
        newRating: 1810,
        outcome: "win",
      },
      {
        tournamentPlayerId: opts.matchId * 10 + 2,
        profileId: opts.matchId * 10 + 2,
        name: opts.loser ?? `${opts.winner}-foe`,
        civId: 2,
        civName: "Mayans",
        civEmblemUrl: null,
        oldRating: 1790,
        newRating: 1780,
        outcome: "loss",
      },
    ],
  }
}

/** Shapes the subset of the query result the card reads. */
function mockQuery(state: {
  data?: HeadToHeadSnapshot
  isPending?: boolean
  isError?: boolean
  refetch?: () => void
}) {
  mockUseHeadToHead.mockReturnValue({
    data: state.data,
    isPending: state.isPending ?? false,
    isError: state.isError ?? false,
    refetch: state.refetch ?? vi.fn(),
  })
}

beforeEach(() => {
  mockUseHeadToHead.mockReset()
})

describe("HeadToHeadCard", () => {
  it("shows an icon + heading + explanatory subtext when there are no games", () => {
    mockQuery({ data: { lastPolledAt: null, games: [] } })
    render(<HeadToHeadCard />)
    expect(screen.getByText("No head-to-head games yet")).toBeInTheDocument()
    expect(
      screen.getByText(/Streamer-vs-streamer clashes show up here/)
    ).toBeInTheDocument()
  })

  it("renders the table headers and each game's matchup, elos, map, and length", () => {
    mockQuery({ data: { lastPolledAt: null, games: [game()] } })
    render(<HeadToHeadCard />)

    // Column headers.
    for (const header of ["Winner", "Loser", "Map", "Length", "When", "Link"]) {
      expect(
        screen.getByRole("columnheader", { name: header })
      ).toBeInTheDocument()
    }

    // Both players, their pre-game ("at the time") ratings, map, and length.
    // Scoped to the table — the winner's name also appears in the summary card.
    const table = screen.getByRole("table")
    expect(within(table).getByText("TheViper")).toBeInTheDocument()
    expect(within(table).getByText("Hera")).toBeInTheDocument()
    expect(within(table).getByText("1834")).toBeInTheDocument()
    expect(within(table).getByText("1798")).toBeInTheDocument()
    expect(within(table).getByText("Arabia")).toBeInTheDocument()
    expect(within(table).getByText("23:14")).toBeInTheDocument()
  })

  it("summarizes who won the most head-to-heads above the table", () => {
    mockQuery({ data: { lastPolledAt: null, games: [game()] } })
    render(<HeadToHeadCard />)
    expect(screen.getByText("Most head-to-head wins")).toBeInTheDocument()
    // Pluralized win count (the _one form for a single win).
    expect(screen.getByText("1 win")).toBeInTheDocument()
    // The leader's name shows in the summary in addition to the table cell.
    expect(screen.getAllByText("TheViper")).toHaveLength(2)
  })

  it("bolds the winner in the table and puts the sheen on the summary leader", () => {
    mockQuery({ data: { lastPolledAt: null, games: [game()] } })
    render(<HeadToHeadCard />)
    const table = screen.getByRole("table")
    // Table winner: bold, no sheen. Loser: plain (not bold, not muted).
    expect(within(table).getByText("TheViper")).toHaveClass("font-semibold")
    expect(within(table).getByText("TheViper")).not.toHaveClass(
      "head-to-head-winner"
    )
    expect(within(table).getByText("Hera")).not.toHaveClass("font-semibold")
    expect(within(table).getByText("Hera")).not.toHaveClass(
      "text-muted-foreground"
    )
    // The animated sheen now lives on the summary card's leader name (the only
    // "TheViper" outside the table).
    const summaryName = screen
      .getAllByText("TheViper")
      .find((el) => !table.contains(el))
    expect(summaryName).toHaveClass("head-to-head-winner")
  })

  it("defaults to newest-first (When descending), reordering the payload", () => {
    mockQuery({
      data: {
        lastPolledAt: null,
        // Passed oldest-first to prove the default sort actively reorders.
        games: [
          makeGame({ matchId: 1, winner: "Older", startedAt: "2026-06-01" }),
          makeGame({ matchId: 2, winner: "Newer", startedAt: "2026-06-05" }),
        ],
      },
    })
    render(<HeadToHeadCard />)
    expect(screen.getByRole("columnheader", { name: "When" })).toHaveAttribute(
      "aria-sort",
      "descending"
    )
    const bodyRows = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
    expect(bodyRows[0]).toHaveTextContent("Newer")
    expect(bodyRows[1]).toHaveTextContent("Older")
  })

  it("re-sorts by winner name when the Winner header is clicked", async () => {
    const user = userEvent.setup()
    mockQuery({
      data: {
        lastPolledAt: null,
        games: [
          makeGame({ matchId: 1, winner: "Zulu", startedAt: "2026-06-05" }),
          makeGame({ matchId: 2, winner: "Alpha", startedAt: "2026-06-01" }),
        ],
      },
    })
    render(<HeadToHeadCard />)
    const table = screen.getByRole("table")
    // Default When-desc → newest (Zulu) first.
    expect(within(table).getAllByRole("row").slice(1)[0]).toHaveTextContent(
      "Zulu"
    )
    await user.click(screen.getByRole("button", { name: "Winner" }))
    // Winner ascending → Alpha first.
    expect(within(table).getAllByRole("row").slice(1)[0]).toHaveTextContent(
      "Alpha"
    )
  })

  it("links each game out to aoe2insights by its match id", () => {
    mockQuery({ data: { lastPolledAt: null, games: [game()] } })
    render(<HeadToHeadCard />)
    expect(
      screen.getByRole("link", { name: "View match on aoe2insights" })
    ).toHaveAttribute("href", "https://www.aoe2insights.com/match/424242/")
  })

  it("shows an em dash for length when the API sent no duration", () => {
    mockQuery({
      data: { lastPolledAt: null, games: [game({ durationSeconds: null })] },
    })
    render(<HeadToHeadCard />)
    // Map still shows in its own cell; the length cell has no clock.
    expect(screen.getByText("Arabia")).toBeInTheDocument()
    expect(screen.queryByText("23:14")).toBeNull()
  })

  it("fires headtohead.match.click when the match link is clicked", async () => {
    const user = userEvent.setup()
    const track = vi.fn()
    const backend: AnalyticsBackend = {
      track,
      identify: vi.fn(),
      page: vi.fn(),
    }
    mockQuery({ data: { lastPolledAt: null, games: [game()] } })
    render(
      <AnalyticsProvider backend={backend}>
        <HeadToHeadCard />
      </AnalyticsProvider>
    )
    await user.click(
      screen.getByRole("link", { name: "View match on aoe2insights" })
    )
    expect(track).toHaveBeenCalledWith("headtohead.match.click", {
      matchId: 424242,
      source: "stats",
    })
  })

  it("shows an error state with a retry that refetches", async () => {
    const user = userEvent.setup()
    const refetch = vi.fn()
    mockQuery({ isError: true, refetch })
    render(<HeadToHeadCard />)
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("keeps the section title while the query is pending", () => {
    mockQuery({ isPending: true })
    render(<HeadToHeadCard />)
    expect(screen.getByText("Head-to-head")).toBeInTheDocument()
    expect(screen.queryByText("No head-to-head games yet")).toBeNull()
  })
})

describe("HeadToHeadMobileList", () => {
  const NOW = new Date("2026-06-06T12:00:00Z")

  it("shows the matchup in a slim row, the other stats hidden until expanded", () => {
    render(<HeadToHeadMobileList games={[game()]} now={NOW} />)
    // One collapsed trigger per game; it carries the winner and loser names.
    const trigger = screen.getByRole("button", { name: /TheViper/ })
    expect(trigger).toHaveTextContent("Hera")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    // Winner is bold, loser plain — same emphasis as the desktop table.
    expect(within(trigger).getByText("TheViper")).toHaveClass("font-semibold")
    expect(within(trigger).getByText("Hera")).not.toHaveClass("font-semibold")
    // The other-stats panel is unmounted while collapsed.
    expect(screen.queryByText("Map")).not.toBeInTheDocument()
    expect(screen.queryByText("Length")).not.toBeInTheDocument()
  })

  it("expands to reveal map, length, when, and the match link", async () => {
    const user = userEvent.setup()
    render(<HeadToHeadMobileList games={[game()]} now={NOW} />)
    await user.click(screen.getByRole("button", { name: /TheViper/ }))
    expect(screen.getByText("Map")).toBeInTheDocument()
    expect(screen.getByText("Arabia")).toBeInTheDocument()
    expect(screen.getByText("Length")).toBeInTheDocument()
    expect(screen.getByText("23:14")).toBeInTheDocument()
    expect(screen.getByText("When")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "View match on aoe2insights" })
    ).toHaveAttribute("href", "https://www.aoe2insights.com/match/424242/")
  })

  it("renders one slim row per game", () => {
    render(
      <HeadToHeadMobileList
        games={[
          makeGame({ matchId: 1, winner: "A", startedAt: "2026-06-05" }),
          makeGame({ matchId: 2, winner: "B", startedAt: "2026-06-04" }),
        ]}
        now={NOW}
      />
    )
    expect(screen.getAllByRole("button")).toHaveLength(2)
  })
})
