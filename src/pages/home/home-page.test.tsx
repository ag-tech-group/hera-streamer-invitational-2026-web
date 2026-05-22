import {
  getGetStandingsV1TournamentsTournamentSlugStandingsGetMockHandler as standingsHandler,
  getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetMockHandler as teamsHandler,
} from "@/api/generated/hooks/tournaments/tournaments.msw"
import type {
  ListEnvelopeStandingRow,
  ListEnvelopeTeamStandingRow,
} from "@/api/generated/types"
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
      current_rating: 2797,
      max_rating: 3045,
      wins: 4964,
      losses: 1701,
      streak: 33,
      recent_results: ["win", "win", "loss", "win", "win"],
      tournament_record: { games_played: 12, wins: 9, losses: 3, streak: 2 },
      rank: 1,
      rank_total: 47834,
      in_match: false,
      live_match_id: null,
      last_match_at: "2026-05-20T04:54:36Z",
      updated_at: "2026-05-20T17:26:34Z",
    },
    {
      profile_id: 102,
      alias: "Player Two",
      country: "au",
      current_rating: 2718,
      max_rating: 2892,
      wins: 3001,
      losses: 1315,
      streak: 7,
      recent_results: ["loss", "win", "loss"],
      tournament_record: { games_played: 7, wins: 3, losses: 4, streak: -1 },
      rank: 2,
      rank_total: 47834,
      in_match: false,
      live_match_id: null,
      last_match_at: "2026-05-05T02:02:27Z",
      updated_at: "2026-05-20T17:26:34Z",
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
        { profile_id: 101, alias: "Player One", current_rating: 2797 },
        { profile_id: 102, alias: "Player Two", current_rating: 2718 },
      ],
    },
  ],
}

describe("HomePage", () => {
  it("renders the page heading", async () => {
    server.use(standingsHandler(standings))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(
      screen.getByRole("heading", { name: /live standings/i })
    ).toBeInTheDocument()
  })

  it("renders a row for each player in the standings", async () => {
    server.use(standingsHandler(standings))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(await screen.findByText("Player One")).toBeInTheDocument()
    expect(await screen.findByText("Player Two")).toBeInTheDocument()
  })

  it("shows how recently the standings were last updated", async () => {
    server.use(standingsHandler(standings))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(await screen.findByText(/updated/i)).toBeInTheDocument()
  })

  it("shows an empty state when the standings are empty", async () => {
    server.use(standingsHandler({ last_polled_at: null, items: [] }))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(await screen.findByText(/no standings yet/i)).toBeInTheDocument()
  })

  it("shows an error state when the standings request fails", async () => {
    server.use(
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
    server.use(standingsHandler(standings), teamsHandler(teamStandings))
    const user = userEvent.setup()

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    await user.click(screen.getByRole("button", { name: "Teams" }))

    expect(await screen.findByText("Team One")).toBeInTheDocument()
  })
})
