import {
  getGetStandingsV1TournamentsTournamentSlugStandingsGetMockHandler as standingsHandler,
  getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetMockHandler as teamsHandler,
  getGetTournamentDetailV1TournamentsTournamentSlugGetMockHandler as tournamentHandler,
} from "@/api/generated/hooks/tournaments/tournaments.msw"
import type {
  ListEnvelopeStandingRow,
  ListEnvelopeTeamStandingRow,
  TournamentRead,
} from "@/api/generated/types"
import { activeTournament } from "@/config/tournaments"
import { renderWithFileRoutes } from "@/test/renderers"
import { server } from "@/test/setup"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

// Deterministic per-test fixtures; aliases are generic placeholders so no
// tournament-sensitive detail lands in a public artifact (see CLAUDE.md).
const standings: ListEnvelopeStandingRow = {
  last_polled_at: "2026-05-20T17:26:34Z",
  items: [
    {
      profile_id: 101,
      alias: "Player One",
      country: "ca",
      team: null,
      presentation: {},
      current_rating: 2797,
      max_rating: 3045,
      wins: 4964,
      losses: 1701,
      streak: 33,
      recent_results: ["win", "win", "loss", "win", "win"],
      tournament_record: {
        games_played: 12,
        wins: 9,
        losses: 3,
        streak: 2,
        peak_rating: 2810,
        last_match_at: "2026-05-20T04:54:36Z",
        recent_results: ["win", "win", "loss", "win", "win"],
        win_pct: 75.0,
      },
      rank: 1,
      rank_total: 47834,
      in_match: false,
      live_match_id: null,
      stream_live: false,
      last_match_at: "2026-05-20T04:54:36Z",
      updated_at: "2026-05-20T17:26:34Z",
      games: 12,
      win_pct: 75.0,
    },
    {
      profile_id: 102,
      alias: "Player Two",
      country: "au",
      team: null,
      presentation: {},
      current_rating: 2718,
      max_rating: 2892,
      wins: 3001,
      losses: 1315,
      streak: 7,
      recent_results: ["loss", "win", "loss"],
      tournament_record: {
        games_played: 7,
        wins: 3,
        losses: 4,
        streak: -1,
        peak_rating: 2740,
        last_match_at: "2026-05-05T02:02:27Z",
        recent_results: ["loss", "win", "loss"],
        win_pct: 42.9,
      },
      rank: 2,
      rank_total: 47834,
      in_match: false,
      live_match_id: null,
      stream_live: false,
      last_match_at: "2026-05-05T02:02:27Z",
      updated_at: "2026-05-20T17:26:34Z",
      games: 7,
      win_pct: 42.9,
    },
  ],
}

const teamStandings: ListEnvelopeTeamStandingRow = {
  last_polled_at: "2026-05-20T17:26:34Z",
  items: [
    {
      team_id: 1,
      name: "Team One",
      initials: "ON",
      member_count: 2,
      combined_rating_sum: 5515,
      combined_rating_average: 2757.5,
      members: [
        {
          profile_id: 101,
          alias: "Player One",
          country: "us",
          current_rating: 2797,
          max_rating: 3045,
          in_match: false,
          live_match_id: null,
          is_captain: false,
        },
        {
          profile_id: 102,
          alias: "Player Two",
          country: null,
          current_rating: 2718,
          max_rating: 2892,
          in_match: false,
          live_match_id: null,
          is_captain: false,
        },
      ],
    },
  ],
}

// Default tournament fixture: no dates set, so the hero countdown stays
// hidden in tests that aren't about it. Overridden per-test where needed.
const tournament: TournamentRead = {
  id: 1,
  slug: "kings-gauntlet",
  name: "Test Tournament",
  leaderboard_id: 3,
  start_date: null,
  grand_finals_date: null,
  prize_pool_cents: null,
  host_stream_urls: [],
  created_at: "2026-05-01T00:00:00Z",
}

// The countdown labels brand-highlight one word, so `<Trans>` splits the
// text across a text node + a <span>. Match the containing <p>'s full
// textContent — and filter to <p> so we don't collide with the standings
// table's "Active" status cells.
const fullLabel =
  (text: string) =>
  (_content: string, el: Element | null): boolean =>
    el !== null && el.tagName === "P" && el.textContent === text

describe("HomePage", () => {
  it("shows the logo lockup as the heading and the live name in the navbar", async () => {
    server.use(standingsHandler(standings), tournamentHandler(tournament))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    // The hero <h1> is the full tournament lockup (#180); its accessible name
    // comes from the build-time config (the image alt), not the live
    // metadata, so it's present immediately without awaiting the fetch.
    expect(
      screen.getByRole("heading", { name: activeTournament.name })
    ).toBeInTheDocument()

    // The live tournament name headlines the navbar instead, as the home
    // link — it resolves to the fetched name once the metadata loads.
    expect(
      await screen.findByRole("link", { name: "Test Tournament" })
    ).toBeInTheDocument()
  })

  it("renders a row for each player in the standings", async () => {
    server.use(standingsHandler(standings), tournamentHandler(tournament))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(await screen.findByText("Player One")).toBeInTheDocument()
    expect(await screen.findByText("Player Two")).toBeInTheDocument()
  })

  it("shows how recently the standings were last updated", async () => {
    server.use(standingsHandler(standings), tournamentHandler(tournament))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(await screen.findByText(/updated/i)).toBeInTheDocument()
  })

  it("shows an empty state when the standings are empty", async () => {
    server.use(
      standingsHandler({ last_polled_at: null, items: [] }),
      tournamentHandler(tournament)
    )

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(await screen.findByText(/no standings yet/i)).toBeInTheDocument()
  })

  it("shows an error state when the standings request fails", async () => {
    server.use(
      tournamentHandler(tournament),
      http.get("*/v1/tournaments/:tournamentSlug/standings", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 })
      )
    )

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(
      await screen.findByText(/couldn't load standings/i)
    ).toBeInTheDocument()
  })

  it("switches to the Teams tab and shows the team standings", async () => {
    server.use(
      standingsHandler(standings),
      teamsHandler(teamStandings),
      tournamentHandler(tournament)
    )
    const user = userEvent.setup()

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    await user.click(screen.getByRole("link", { name: "Teams" }))

    expect(await screen.findByText("Team One")).toBeInTheDocument()
  })

  it("deep-links straight to the Teams view at /teams", async () => {
    server.use(
      standingsHandler(standings),
      teamsHandler(teamStandings),
      tournamentHandler(tournament)
    )

    await renderWithFileRoutes(<div />, { initialLocation: "/teams" })

    expect(await screen.findByText("Team One")).toBeInTheDocument()
  })

  it("shows the 'Ladder Race Begins' countdown before the race starts", async () => {
    // 7 days ahead — far enough that digits don't tick to zero mid-test.
    const startDate = new Date(Date.now() + 7 * 86_400_000).toISOString()
    server.use(
      standingsHandler(standings),
      tournamentHandler({ ...tournament, start_date: startDate })
    )

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(
      await screen.findByText(fullLabel("Ladder Race Begins"))
    ).toBeInTheDocument()
  })

  it("hides the start countdown when the tournament has no start date", async () => {
    server.use(standingsHandler(standings), tournamentHandler(tournament))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    // Wait for the page to render so the countdown has its chance to appear.
    await screen.findByText("Player One")
    expect(
      screen.queryByText(fullLabel("Ladder Race Begins"))
    ).not.toBeInTheDocument()
  })

  it("swaps the start slot for the 'Ladder Race Active' panel once the race has started", async () => {
    // Start 1 day in the past, grand finals 14 days ahead: the race is
    // underway, so the start countdown gives way to the active panel while
    // the "Ladder Race Ends" countdown keeps running.
    const startDate = new Date(Date.now() - 86_400_000).toISOString()
    const grandFinals = new Date(Date.now() + 14 * 86_400_000).toISOString()
    server.use(
      standingsHandler(standings),
      tournamentHandler({
        ...tournament,
        start_date: startDate,
        grand_finals_date: grandFinals,
      })
    )

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(
      await screen.findByText(fullLabel("Ladder Race Active"))
    ).toBeInTheDocument()
    expect(screen.getByText(fullLabel("Ladder Race Ends"))).toBeInTheDocument()
    // The pre-start countdown is gone — the panel has taken its slot.
    expect(
      screen.queryByText(fullLabel("Ladder Race Begins"))
    ).not.toBeInTheDocument()
  })

  it("shows the 'Ladder Race Ends' countdown when grand_finals_date is set", async () => {
    // 30 days ahead — clearly in the future so the countdown stays rendered.
    const grandFinals = new Date(Date.now() + 30 * 86_400_000).toISOString()
    server.use(
      standingsHandler(standings),
      tournamentHandler({ ...tournament, grand_finals_date: grandFinals })
    )

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(
      await screen.findByText(fullLabel("Ladder Race Ends"))
    ).toBeInTheDocument()
  })

  it("hides the end countdown when grand_finals_date is null", async () => {
    server.use(standingsHandler(standings), tournamentHandler(tournament))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    // Wait for the page to render so the countdown has its chance to appear.
    await screen.findByText("Player One")
    expect(
      screen.queryByText(fullLabel("Ladder Race Ends"))
    ).not.toBeInTheDocument()
  })

  it("shows a theme toggle in the header", async () => {
    server.use(standingsHandler(standings), tournamentHandler(tournament))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    // The toggle labels itself by the current theme (Light / Dark / Auto);
    // matching any of the three keeps the test robust to the default.
    expect(
      await screen.findByRole("button", { name: /^(light|dark|auto)$/i })
    ).toBeInTheDocument()
  })
})
