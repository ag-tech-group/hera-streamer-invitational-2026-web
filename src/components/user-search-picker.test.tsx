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
  email: "hera@example.com",
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
          {
            id: "abc-123",
            display_name: "Hera",
            avatar_url: null,
            email: "hera@example.com",
          },
          {
            id: "def-456",
            display_name: "TheViper",
            avatar_url: null,
            email: "viper@example.com",
          },
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
      email: "hera@example.com",
    })
  })

  it("shows the email on a second line beside the display name", async () => {
    server.use(
      http.get("*/users/search", () =>
        HttpResponse.json([
          {
            id: "abc-123",
            display_name: "Hera",
            avatar_url: null,
            email: "hera@example.com",
          },
        ])
      )
    )
    renderPicker(null)
    await userEvent.type(
      screen.getByPlaceholderText(/search by name or email/i),
      "her"
    )
    // A user with both a name and an email shows both in the dropdown.
    expect(await screen.findByText("Hera")).toBeInTheDocument()
    expect(screen.getByText("hera@example.com")).toBeInTheDocument()
  })

  it("falls back to email as the label when display_name is null", async () => {
    server.use(
      http.get("*/users/search", () =>
        HttpResponse.json([
          {
            id: "ghi-789",
            display_name: null,
            avatar_url: null,
            email: "namedless@example.com",
          },
        ])
      )
    )
    renderPicker(null)
    await userEvent.type(
      screen.getByPlaceholderText(/search by name or email/i),
      "name"
    )
    expect(await screen.findByText("namedless@example.com")).toBeInTheDocument()
  })

  it("filters out users with both display_name and email null", async () => {
    server.use(
      http.get("*/users/search", () =>
        HttpResponse.json([
          {
            id: "abc-123",
            display_name: "Hera",
            avatar_url: null,
            email: "hera@example.com",
          },
          // Steam-OAuth pre-tos-gate user — must NOT render. The picker's
          // contract is "never surface a raw UUID," so this row gets dropped
          // entirely rather than falling back to the id.
          {
            id: "stm-000",
            display_name: null,
            avatar_url: null,
            email: null,
          },
        ])
      )
    )
    renderPicker(null)
    await userEvent.type(
      screen.getByPlaceholderText(/search by name or email/i),
      "anyone"
    )
    expect(await screen.findByText("Hera")).toBeInTheDocument()
    expect(screen.queryByText(/stm-000/i)).not.toBeInTheDocument()
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
