import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AnalyticsProvider, type AnalyticsBackend } from "@/lib/analytics"
import { PlayerName } from "@/pages/home/player-name"

/**
 * Unit tests for the shared player-name treatment reused by the players table
 * (`PlayerCell`) and the teams pill (`PlayerPill`) (#350). jsdom's `matchMedia`
 * mock reports no fine-hover pointer (see `src/test/setup.ts`), so `BioHint`
 * renders its touch affordance — the bio shows as an "About {name}" info button.
 */
function renderWithAnalytics(ui: React.ReactNode) {
  const track = vi.fn()
  const backend: AnalyticsBackend = {
    track,
    identify: vi.fn(),
    page: vi.fn(),
  }
  render(<AnalyticsProvider backend={backend}>{ui}</AnalyticsProvider>)
  return track
}

describe("PlayerName — profile link", () => {
  it("links the name to the profile URL in a new tab when one is set", () => {
    render(
      <PlayerName
        name="Hera"
        alias="Hera"
        profileId={1}
        profileUrl="https://www.aoe2insights.com/user/123/"
        source="standings"
      />
    )
    const link = screen.getByRole("link", { name: "Hera" })
    expect(link).toHaveAttribute(
      "href",
      "https://www.aoe2insights.com/user/123/"
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders the name as plain text (no link) when no profile URL is set", () => {
    render(
      <PlayerName name="Hera" alias="Hera" profileId={1} source="standings" />
    )
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByText("Hera")).toBeInTheDocument()
  })

  it("underlines on hover with no brightness shift (#350)", () => {
    render(
      <PlayerName
        name="Hera"
        alias="Hera"
        profileId={1}
        profileUrl="https://example.com"
        source="standings"
      />
    )
    const link = screen.getByRole("link", { name: "Hera" })
    expect(link).toHaveClass("hover:underline")
    expect(link).not.toHaveClass("hover:brightness-125")
  })
})

describe("PlayerName — bio disclosure", () => {
  it("shows the bio info button when a bio is set", () => {
    render(
      <PlayerName
        name="Hera"
        alias="Hera"
        profileId={1}
        bio="Two-time champion."
        source="standings"
      />
    )
    expect(
      screen.getByRole("button", { name: "About Hera" })
    ).toBeInTheDocument()
  })

  it("renders no bio affordance when there's no bio", () => {
    render(
      <PlayerName name="Hera" alias="Hera" profileId={1} source="standings" />
    )
    expect(
      screen.queryByRole("button", { name: /about/i })
    ).not.toBeInTheDocument()
  })
})

describe("PlayerName — name sizing", () => {
  it("keeps the name on one line by default (table)", () => {
    render(
      <PlayerName
        name="Hera"
        alias="Hera"
        profileId={1}
        profileUrl="https://example.com"
        source="standings"
      />
    )
    const link = screen.getByRole("link", { name: "Hera" })
    expect(link).toHaveClass("whitespace-nowrap")
    expect(link).not.toHaveClass("truncate")
  })

  it("truncates the name as a flex child when asked (pill)", () => {
    render(
      <PlayerName
        name="Hera"
        alias="Hera"
        profileId={1}
        profileUrl="https://example.com"
        source="teams"
        truncate
      />
    )
    const link = screen.getByRole("link", { name: "Hera" })
    expect(link).toHaveClass("truncate", "flex-1", "min-w-0")
    expect(link).not.toHaveClass("whitespace-nowrap")
  })
})

describe("PlayerName — analytics (#350)", () => {
  it("fires player.profile.click tagged with the source surface", async () => {
    const user = userEvent.setup()
    const track = renderWithAnalytics(
      <PlayerName
        name="Hera"
        alias="HeraHera"
        profileId={7}
        profileUrl="https://example.com"
        source="teams"
      />
    )
    await user.click(screen.getByRole("link", { name: "Hera" }))
    expect(track).toHaveBeenCalledWith("player.profile.click", {
      profileId: 7,
      alias: "HeraHera",
      source: "teams",
    })
  })

  it("fires player.bio.open tagged with the source surface", async () => {
    const user = userEvent.setup()
    const track = renderWithAnalytics(
      <PlayerName
        name="Hera"
        alias="HeraHera"
        profileId={9}
        bio="Two-time champion."
        source="teams"
      />
    )
    await user.click(screen.getByRole("button", { name: "About Hera" }))
    const bioOpens = track.mock.calls.filter((c) => c[0] === "player.bio.open")
    expect(bioOpens).toHaveLength(1)
    expect(bioOpens[0][1]).toEqual({
      profileId: 9,
      alias: "HeraHera",
      source: "teams",
    })
  })

  it("falls back to the visible name for analytics when alias is null", async () => {
    // An unlinked member has no ladder handle; the click still logs an alias,
    // coalesced to the visible name (mirrors the standings adapter).
    const user = userEvent.setup()
    const track = renderWithAnalytics(
      <PlayerName
        name="Newcomer"
        alias={null}
        profileId={null}
        profileUrl="https://example.com"
        source="teams"
      />
    )
    await user.click(screen.getByRole("link", { name: "Newcomer" }))
    expect(track).toHaveBeenCalledWith("player.profile.click", {
      profileId: null,
      alias: "Newcomer",
      source: "teams",
    })
  })
})
