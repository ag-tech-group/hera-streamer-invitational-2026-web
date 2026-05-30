import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { CountryCombobox } from "@/components/country-combobox"

describe("CountryCombobox", () => {
  it("shows the placeholder when no flag is set", () => {
    render(<CountryCombobox value="" onChange={vi.fn()} />)
    expect(screen.getByRole("combobox")).toHaveTextContent("Select a country")
  })

  it("shows the selected country name for a stored flag emoji", () => {
    render(<CountryCombobox value="🇺🇸" onChange={vi.fn()} />)
    expect(screen.getByRole("combobox")).toHaveTextContent("United States")
  })

  it("filters by typed text and stores the chosen country's flag emoji", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CountryCombobox value="" onChange={onChange} />)

    await user.click(screen.getByRole("combobox"))
    await user.type(
      await screen.findByPlaceholderText("Search countries"),
      "south kor"
    )
    await user.click(
      await screen.findByRole("option", { name: /south korea/i })
    )

    expect(onChange).toHaveBeenCalledWith("🇰🇷")
  })

  it("clears the value via the No-flag option", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CountryCombobox value="🇺🇸" onChange={onChange} />)

    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("button", { name: /no flag/i }))

    expect(onChange).toHaveBeenCalledWith("")
  })
})
