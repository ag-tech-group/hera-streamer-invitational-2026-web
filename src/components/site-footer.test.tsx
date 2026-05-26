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
})
