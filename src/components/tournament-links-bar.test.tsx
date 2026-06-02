import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TournamentLinksBar } from "@/components/tournament-links-bar"
import { AnalyticsProvider, type AnalyticsBackend } from "@/lib/analytics"
import type { TournamentLink } from "@/types"

const links: TournamentLink[] = [
  { label: "Info Video", url: "https://youtube.com/watch?v=a", kind: "video" },
  { label: "Handbook", url: "https://example.com/handbook", kind: "handbook" },
  { label: "Discord", url: "https://discord.gg/example", kind: "discord" },
]

describe("TournamentLinksBar", () => {
  it("renders nothing when there are no links", () => {
    const { container } = render(<TournamentLinksBar links={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when links is undefined", () => {
    const { container } = render(<TournamentLinksBar links={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders each link as an external chip opening in a new tab", () => {
    render(<TournamentLinksBar links={links} />)
    const handbook = screen.getByRole("link", { name: "Handbook" })
    expect(handbook).toHaveAttribute("href", "https://example.com/handbook")
    expect(handbook).toHaveAttribute("target", "_blank")
    expect(handbook).toHaveAttribute("rel", "noopener noreferrer")
    expect(screen.getAllByRole("link")).toHaveLength(links.length)
  })

  it("labels the nav landmark for assistive tech", () => {
    render(<TournamentLinksBar links={links} />)
    expect(
      screen.getByRole("navigation", { name: "Tournament resources" })
    ).toBeInTheDocument()
  })

  it("tracks a click with the link kind and resource_bar source (#215)", async () => {
    const track = vi.fn()
    const backend: AnalyticsBackend = {
      track,
      identify: vi.fn(),
      page: vi.fn(),
    }
    const user = userEvent.setup()
    render(
      <AnalyticsProvider backend={backend}>
        <TournamentLinksBar links={links} />
      </AnalyticsProvider>
    )
    await user.click(screen.getByRole("link", { name: "Discord" }))
    expect(track).toHaveBeenCalledWith("tournament.link.click", {
      kind: "discord",
      source: "resource_bar",
    })
  })
})
