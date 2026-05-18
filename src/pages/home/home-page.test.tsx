import { renderWithFileRoutes } from "@/test/renderers"
import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

describe("HomePage", () => {
  it("renders the page heading", async () => {
    await renderWithFileRoutes(<div />, { initialLocation: "/" })

    expect(
      screen.getByRole("heading", { name: /live standings/i })
    ).toBeInTheDocument()
  })
})
