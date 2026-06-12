import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import { activeTournament } from "@/config/tournaments"
import { TournamentDetailsSection } from "@/pages/admin/sections/tournament-details-section"
import { server } from "@/test/setup"

const slug = activeTournament.apiTournamentSlug

/** Minimal `TournamentRead` DTO the detail GET returns; override per test. */
function tournamentDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug,
    name: "Test Tournament",
    leaderboard_id: 3,
    start_date: null,
    end_date: null,
    prize_pool_cents: null,
    host_stream_urls: [],
    created_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }
}

/**
 * Mock the detail GET (seeds the form) and capture each PATCH body so a test
 * can assert what gets sent. Returns the captured-bodies array.
 */
function setupTournament(dtoOverrides: Record<string, unknown> = {}) {
  const bodies: Array<Record<string, unknown>> = []
  server.use(
    http.get(`*/v1/tournaments/${slug}`, () =>
      HttpResponse.json(tournamentDto(dtoOverrides))
    ),
    http.patch(`*/v1/tournaments/${slug}`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      bodies.push(body)
      // Echo the merged record back so the post-save invalidation refetch
      // resolves against a valid shape.
      return HttpResponse.json(tournamentDto({ ...dtoOverrides, ...body }))
    })
  )
  return bodies
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TournamentDetailsSection />
    </QueryClientProvider>
  )
}

describe("TournamentDetailsSection — host stream URLs (#225)", () => {
  beforeEach(() => {
    setupTournament()
  })

  it("seeds existing URLs and round-trips them on save", async () => {
    const bodies = setupTournament({
      host_stream_urls: ["https://twitch.tv/host"],
    })
    const user = userEvent.setup()
    renderSection()

    const row = await screen.findByLabelText("Host stream URL 1")
    expect(row).toHaveValue("https://twitch.tv/host")

    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].host_stream_urls).toEqual(["https://twitch.tv/host"])
  })

  it("adds a URL row and includes it in the PATCH body", async () => {
    const bodies = setupTournament()
    const user = userEvent.setup()
    renderSection()

    await user.click(await screen.findByRole("button", { name: "Add URL" }))
    await user.type(
      screen.getByLabelText("Host stream URL 1"),
      "https://youtube.com/@host"
    )
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].host_stream_urls).toEqual(["https://youtube.com/@host"])
  })

  it("sends [] when every row is removed", async () => {
    const bodies = setupTournament({
      host_stream_urls: ["https://twitch.tv/host"],
    })
    const user = userEvent.setup()
    renderSection()

    await user.click(
      await screen.findByRole("button", {
        name: "Remove host stream URL 1",
      })
    )
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].host_stream_urls).toEqual([])
  })

  it("blocks save and shows an inline error when a URL exceeds the length cap", async () => {
    const bodies = setupTournament()
    const user = userEvent.setup()
    renderSection()

    await user.click(await screen.findByRole("button", { name: "Add URL" }))
    // 257 chars — one past the 256 cap.
    await user.type(
      screen.getByLabelText("Host stream URL 1"),
      `https://twitch.tv/${"a".repeat(257)}`
    )
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(
      await screen.findByText(/256 characters or fewer/i)
    ).toBeInTheDocument()
    // Submit was blocked — no PATCH fired.
    expect(bodies).toHaveLength(0)
  })

  it("caps the Add button at 5 rows", async () => {
    setupTournament({
      host_stream_urls: [
        "https://twitch.tv/a",
        "https://twitch.tv/b",
        "https://twitch.tv/c",
        "https://twitch.tv/d",
        "https://twitch.tv/e",
      ],
    })
    renderSection()

    // Five seeded rows present, Add disabled at the limit.
    await screen.findByLabelText("Host stream URL 5")
    expect(screen.getByRole("button", { name: "Add URL" })).toBeDisabled()
  })

  it("drops blank rows from the PATCH body", async () => {
    const bodies = setupTournament({
      host_stream_urls: ["https://twitch.tv/host"],
    })
    const user = userEvent.setup()
    renderSection()

    // Add an empty second row, then save without filling it.
    await screen.findByLabelText("Host stream URL 1")
    await user.click(screen.getByRole("button", { name: "Add URL" }))
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].host_stream_urls).toEqual(["https://twitch.tv/host"])
  })

  it("keeps the other metadata fields in the PATCH body", async () => {
    const bodies = setupTournament({ name: "Kings Gauntlet" })
    const user = userEvent.setup()
    renderSection()

    // Wait for the form to seed, then save unchanged.
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Kings Gauntlet")
    )
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].name).toBe("Kings Gauntlet")
    expect(bodies[0]).toHaveProperty("host_stream_urls")
  })
})
