import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SiteFooter } from "@/components/site-footer"

describe("SiteFooter", () => {
  it("renders criticalbit.gg as an external link", () => {
    render(<SiteFooter />)
    const link = screen.getByRole("link", { name: /criticalbit\.gg/i })
    expect(link).toHaveAttribute("href", "https://criticalbit.gg")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("links the criticalbit Privacy and Terms policies (#216)", () => {
    render(<SiteFooter />)
    const privacy = screen.getByRole("link", { name: /privacy/i })
    expect(privacy).toHaveAttribute("href", "https://criticalbit.gg/privacy")
    expect(privacy).toHaveAttribute("target", "_blank")
    expect(privacy).toHaveAttribute("rel", "noopener noreferrer")

    const terms = screen.getByRole("link", { name: /terms/i })
    expect(terms).toHaveAttribute("href", "https://criticalbit.gg/terms")
    expect(terms).toHaveAttribute("target", "_blank")
    expect(terms).toHaveAttribute("rel", "noopener noreferrer")
  })
})
