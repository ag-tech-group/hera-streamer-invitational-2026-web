import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { UserSearchPicker } from "@/components/user-search-picker"
import type { UserSearchResult } from "@/lib/auth-config"
import { server } from "@/test/setup"

const sample: UserSearchResult = {
  id: "abc-123",
  display_name: "Hera",
  avatar_url: null,
}

function renderPicker(initial: UserSearchResult | null = null) {
  const onSelect = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <UserSearchPicker selected={initial} onSelect={onSelect} />
    </QueryClientProvider>
  )
  return { ...utils, onSelect }
}

describe("UserSearchPicker", () => {
  it("renders a search input when nothing is selected", () => {
    renderPicker(null)
    expect(
      screen.getByPlaceholderText(/search by name or email/i)
    ).toBeInTheDocument()
  })

  it("renders the selected user as a chip with a clear button", () => {
    renderPicker(sample)
    expect(screen.getByText("Hera")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /clear selected user/i })
    ).toBeInTheDocument()
  })

  it("calls onSelect(null) when the clear button is clicked", async () => {
    const { onSelect } = renderPicker(sample)
    await userEvent.click(
      screen.getByRole("button", { name: /clear selected user/i })
    )
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it("surfaces search results in a dropdown and calls onSelect on result click", async () => {
    server.use(
      http.get("*/users/search", () =>
        HttpResponse.json([
          { id: "abc-123", display_name: "Hera", avatar_url: null },
          { id: "def-456", display_name: "TheViper", avatar_url: null },
        ])
      )
    )
    const { onSelect } = renderPicker(null)
    const input = screen.getByPlaceholderText(/search by name or email/i)
    await userEvent.type(input, "her")

    // Debounce is 250ms; findByText waits up to ~1s by default.
    const option = await screen.findByText("Hera")
    expect(option).toBeInTheDocument()
    expect(screen.getByText("TheViper")).toBeInTheDocument()

    // `onMouseDown` is what the picker listens for; userEvent dispatches it.
    await userEvent.click(option)
    expect(onSelect).toHaveBeenCalledWith({
      id: "abc-123",
      display_name: "Hera",
      avatar_url: null,
    })
  })

  it("shows the empty-state copy when the search returns no matches", async () => {
    server.use(http.get("*/users/search", () => HttpResponse.json([])))
    renderPicker(null)
    await userEvent.type(
      screen.getByPlaceholderText(/search by name or email/i),
      "nope"
    )
    expect(
      await screen.findByText(/no users match that search/i)
    ).toBeInTheDocument()
  })
})
