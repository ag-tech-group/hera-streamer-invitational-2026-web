import { getGetStandingsV1LeaderboardsLeaderboardIdStandingsGetMockHandler as standingsHandler } from "@/api/generated/hooks/leaderboards/leaderboards.msw"
import type { ListEnvelopeStandingRow } from "@/api/generated/types"
import { renderWithFileRoutes } from "@/test/renderers"
import { server } from "@/test/setup"
import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

// Deterministic per-test fixture; aliases are generic placeholders so no
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
      rank: 1,
      rank_total: 47834,
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
      rank: 2,
      rank_total: 47834,
      last_match_at: "2026-05-05T02:02:27Z",
      updated_at: "2026-05-20T17:26:34Z",
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

  it("shows an empty state when the standings are empty", async () => {
    server.use(standingsHandler({ last_polled_at: null, items: [] }))

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(
      await screen.findByText(/no standings to show yet/i)
    ).toBeInTheDocument()
  })

  it("shows an error state when the standings request fails", async () => {
    server.use(
      http.get("*/v1/leaderboards/:leaderboardId/standings", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 })
      )
    )

    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(
      await screen.findByText(/couldn't load standings/i)
    ).toBeInTheDocument()
  })
})
