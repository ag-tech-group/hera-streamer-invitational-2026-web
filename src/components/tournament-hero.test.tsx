import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TournamentHero } from "@/components/tournament-hero"
import { AnalyticsProvider, type AnalyticsBackend } from "@/lib/analytics"
import i18n from "@/lib/i18n"

describe("TournamentHero", () => {
  // `changeLanguage` mutates the shared i18n singleton — reset to English so
  // this case (and every other test) starts from a known language.
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  it("updates the subtitle when the language changes", async () => {
    const { container } = render(<TournamentHero />)
    expect(container.textContent).toContain(
      "Live ratings, team standings, and tournament progression"
    )

    await act(async () => {
      await i18n.changeLanguage("fr")
    })

    // The regression guard: the `<Trans>` subtitle must follow a language
    // switch. Without `useTranslation()` in the hero, this stayed English.
    expect(container.textContent).toContain(
      "Classements en direct, classement par équipe et progression du tournoi"
    )
    expect(container.textContent).not.toContain("Live ratings")
  })

  it("tracks a click on the AoE2:DE product link in the subtitle (#215)", async () => {
    const track = vi.fn()
    const backend: AnalyticsBackend = {
      track,
      identify: vi.fn(),
      page: vi.fn(),
    }
    const user = userEvent.setup()
    render(
      <AnalyticsProvider backend={backend}>
        <TournamentHero />
      </AnalyticsProvider>
    )

    await user.click(
      screen.getByRole("link", {
        name: /Age of Empires 2: Definitive Edition/i,
      })
    )

    expect(track).toHaveBeenCalledWith("product.link.click", {
      product: "aoe2_de",
      source: "hero_subtitle",
    })
  })
})
