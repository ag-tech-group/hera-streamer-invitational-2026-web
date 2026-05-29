import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { OwnersSection } from "@/pages/admin/sections/owners-section"
import { server } from "@/test/setup"

// Pin the current user so the sole-owner-self guard has a known identity.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ userId: "user-1" }),
}))

type Owner = {
  user_id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
}

function owner(overrides: Partial<Owner> & Pick<Owner, "user_id">): Owner {
  return {
    display_name: null,
    email: null,
    avatar_url: null,
    created_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }
}

function renderOwners() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <OwnersSection />
    </QueryClientProvider>
  )
}

describe("OwnersSection — sole-owner self-removal guard (#123)", () => {
  it("disables Remove (with a hint) for the sole owner when it's the current user", async () => {
    server.use(
      http.get("*/v1/tournaments/:slug/owners", () =>
        HttpResponse.json([
          owner({
            user_id: "user-1",
            display_name: "Me",
            email: "me@example.com",
          }),
        ])
      )
    )
    renderOwners()

    expect(
      await screen.findByRole("button", { name: "Revoke Me" })
    ).toBeDisabled()
    expect(screen.getByTitle(/only owner/i)).toBeInTheDocument()
  })

  it("enables the current user's Remove once a second owner exists", async () => {
    server.use(
      http.get("*/v1/tournaments/:slug/owners", () =>
        HttpResponse.json([
          owner({
            user_id: "user-1",
            display_name: "Me",
            email: "me@example.com",
          }),
          owner({
            user_id: "user-2",
            display_name: "Cohost",
            email: "co@example.com",
          }),
        ])
      )
    )
    renderOwners()

    expect(
      await screen.findByRole("button", { name: "Revoke Me" })
    ).toBeEnabled()
  })
})
