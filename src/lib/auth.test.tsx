import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { AuthProvider, useAuth } from "@/lib/auth"
import { server } from "@/test/setup"

/**
 * Direct tests of the auth provider — exercises the /v1/me probe path
 * and the derived `isAdmin` rule against `activeTournament.apiTournamentSlug`
 * (the active tournament's API slug is `"default"` for this build).
 */

function renderAuth() {
  // Each test gets its own QueryClient so caches don't leak between cases.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
  })
}

describe("AuthProvider", () => {
  it("settles to unauthenticated when /v1/me returns 401", async () => {
    // The default handler in src/api/handlers.ts already returns 401, but
    // pinning it here makes the test self-contained.
    server.use(
      http.get("*/v1/me", () =>
        HttpResponse.json({ detail: "Not authenticated" }, { status: 401 })
      )
    )
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.userId).toBeNull()
    expect(result.current.isAdmin).toBe(false)
  })

  it("marks the user authenticated when /v1/me returns 200", async () => {
    server.use(
      http.get("*/v1/me", () =>
        HttpResponse.json(
          { user_id: "user-1", owned_tournaments: [] },
          { status: 200 }
        )
      )
    )
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(result.current.userId).toBe("user-1")
    expect(result.current.isAdmin).toBe(false)
  })

  it("sets isAdmin when the active tournament is in owned_tournaments", async () => {
    // `activeTournament.apiTournamentSlug` is "default" for this build.
    server.use(
      http.get("*/v1/me", () =>
        HttpResponse.json(
          {
            user_id: "user-1",
            owned_tournaments: [
              {
                id: 1,
                slug: "default",
                name: "Default Tournament",
                leaderboard_id: 3,
                start_date: null,
                grand_finals_date: null,
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
          },
          { status: 200 }
        )
      )
    )
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.isAdmin).toBe(true))
    expect(result.current.isAuthenticated).toBe(true)
  })

  it("keeps isAdmin false for users who own other tournaments but not this one", async () => {
    server.use(
      http.get("*/v1/me", () =>
        HttpResponse.json(
          {
            user_id: "user-1",
            owned_tournaments: [
              {
                id: 99,
                slug: "some-other-tournament",
                name: "Other",
                leaderboard_id: 3,
                start_date: null,
                grand_finals_date: null,
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
          },
          { status: 200 }
        )
      )
    )
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(result.current.isAdmin).toBe(false)
  })

  it("re-probes when `refresh` is called", async () => {
    let callCount = 0
    server.use(
      http.get("*/v1/me", () => {
        callCount += 1
        return HttpResponse.json(
          { detail: "Not authenticated" },
          { status: 401 }
        )
      })
    )
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(callCount).toBe(1)
    await act(() => result.current.refresh())
    expect(callCount).toBe(2)
  })
})
