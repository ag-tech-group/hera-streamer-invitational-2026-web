import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { TeamsSection } from "@/pages/admin/sections/teams-section"
import { server } from "@/test/setup"

/**
 * Minimal team-standings row (snake_case DTO). The adapter maps it to the
 * UI-facing shape; here we only populate the fields the admin card renders.
 */
function teamStanding(member: { profile_id: number; alias: string }) {
  return {
    team_id: 1,
    name: "Team Alpha",
    initials: "TA",
    member_count: 1,
    combined_rating_sum: 2000,
    combined_rating_average: 2000,
    members: [
      {
        profile_id: member.profile_id,
        alias: member.alias,
        country: null,
        current_rating: 2000,
        in_match: false,
        live_match_id: null,
        is_captain: false,
      },
    ],
  }
}

/** A polled roster entry carrying an optional presentation override. */
function rosterPlayer(player: {
  profile_id: number
  alias: string
  presentation?: Record<string, unknown>
}) {
  return {
    profile_id: player.profile_id,
    alias: player.alias,
    country: null,
    presentation: player.presentation,
  }
}

function mockTeamsAndRoster(
  standing: ReturnType<typeof teamStanding>,
  roster: ReturnType<typeof rosterPlayer>[]
) {
  server.use(
    http.get("*/v1/tournaments/:slug/teams/standings", () =>
      HttpResponse.json({ last_polled_at: null, items: [standing] })
    ),
    http.get("*/v1/tournaments/:slug/players", () =>
      HttpResponse.json({ last_polled_at: null, items: roster })
    )
  )
}

function renderTeams() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamsSection />
    </QueryClientProvider>
  )
}

describe("TeamsSection — member chips show the host's Display name", () => {
  it("shows the Display name override on a member chip, not the ladder alias", async () => {
    mockTeamsAndRoster(
      teamStanding({ profile_id: 1819870, alias: "TheViper_aM" }),
      [
        rosterPlayer({
          profile_id: 1819870,
          alias: "TheViper_aM",
          presentation: { displayName: "TheViper" },
        }),
      ]
    )
    renderTeams()

    // The chip resolves the override from the roster the Players tab edits,
    // even though the team-standings endpoint only returns the raw alias.
    // The exact accessible name proves it's the override, not the alias.
    expect(
      await screen.findByRole("button", { name: "Remove TheViper from team" })
    ).toBeInTheDocument()
    // The raw ladder alias no longer surfaces once the roster has loaded.
    expect(screen.queryByText("TheViper_aM")).not.toBeInTheDocument()
  })

  it("falls back to the ladder alias when the member has no override", async () => {
    mockTeamsAndRoster(teamStanding({ profile_id: 1234, alias: "uThermal" }), [
      rosterPlayer({ profile_id: 1234, alias: "uThermal" }),
    ])
    renderTeams()

    expect(
      await screen.findByRole("button", { name: "Remove uThermal from team" })
    ).toBeInTheDocument()
  })
})
