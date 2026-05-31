import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { HostLinksCard } from "@/components/host-links-card"
import type { HostLink } from "@/types"

const links: HostLink[] = [
  { label: "Twitch", url: "https://twitch.tv/example", kind: "twitch" },
  { label: "YouTube", url: "https://youtube.com/@example", kind: "youtube" },
  { label: "Donate", url: "https://example.com/tip", kind: "donate" },
]

describe("HostLinksCard", () => {
  it("renders nothing when there are no links", () => {
    const { container } = render(<HostLinksCard links={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders muted links with no Live badge by default", () => {
    render(<HostLinksCard links={links} label="Hosted by Hera" />)
    expect(screen.getByRole("link", { name: "Twitch" })).toHaveClass(
      "text-muted-foreground"
    )
    expect(screen.queryByText("Live")).not.toBeInTheDocument()
  })

  it("shows the Live badge and glows the broadcast links when live (#149)", () => {
    render(<HostLinksCard links={links} label="Hosted by Hera" streamLive />)
    // Eyebrow Live badge is back.
    expect(screen.getByText("Live")).toBeInTheDocument()
    // Twitch / YouTube glow brand-blue; Donate stays muted so the emphasis
    // lands on the channels you'd actually go watch.
    expect(screen.getByRole("link", { name: "Twitch" })).toHaveClass(
      "text-brand"
    )
    expect(screen.getByRole("link", { name: "YouTube" })).toHaveClass(
      "text-brand"
    )
    expect(screen.getByRole("link", { name: "Donate" })).toHaveClass(
      "text-muted-foreground"
    )
  })
})
