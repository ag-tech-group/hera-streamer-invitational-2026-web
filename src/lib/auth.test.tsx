import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it } from "vitest"

import { AuthProvider, useAuth } from "@/lib/auth"
import { server } from "@/test/setup"

/**
 * Direct tests of the auth provider — exercises the /v1/me probe path
 * and the derived `isAdmin` rule against `activeTournament.apiTournamentSlug`
 * (the active tournament's API slug is `"default"` for this build).
 */

const AUTH_HINT_KEY = "criticalbit_auth_hint"

afterEach(() => {
  // Auth tests share a jsdom localStorage — clear the hint between
  // cases so a test that wants the "first-time visitor" path doesn't
  // inherit a stale flag from a previous case.
  window.localStorage.removeItem(AUTH_HINT_KEY)
})

/**
 * `withHint: true` (default) pre-seeds the localStorage flag that
 * `AuthProvider.refresh()` checks before firing the auth probes — most
 * existing tests need this so the probes actually run. Pass
 * `{ withHint: false }` for cases that exercise the no-hint skip path.
 */
function renderAuth({ withHint = true }: { withHint?: boolean } = {}) {
  if (withHint) {
    window.localStorage.setItem(AUTH_HINT_KEY, "1")
  }
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

describe("AuthProvider — first-time visitor skip path (#134)", () => {
  it("skips both probes when no localStorage hint is set", async () => {
    // Track whether the probes fire — they shouldn't, because the visitor
    // has no signal of ever having been authenticated with us.
    let meCalled = false
    let authMeCalled = false
    server.use(
      http.get("*/v1/me", () => {
        meCalled = true
        return HttpResponse.json(
          { detail: "Not authenticated" },
          { status: 401 }
        )
      }),
      http.get("*/auth/me", () => {
        authMeCalled = true
        return HttpResponse.json(
          { detail: "Not authenticated" },
          { status: 401 }
        )
      })
    )
    const { result } = renderAuth({ withHint: false })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(meCalled).toBe(false)
    expect(authMeCalled).toBe(false)
  })

  it("fires the probes when the hint is present (returning visitor)", async () => {
    let meCalled = false
    server.use(
      http.get("*/v1/me", () => {
        meCalled = true
        return HttpResponse.json(
          { detail: "Not authenticated" },
          { status: 401 }
        )
      })
    )
    // withHint: true (default) — simulates a returning visitor whose
    // previous session set the hint.
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(meCalled).toBe(true)
  })
})

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

  it("marks the user authenticated when both /v1/me and /auth/me return 200", async () => {
    server.use(
      http.get("*/v1/me", () =>
        HttpResponse.json(
          { user_id: "user-1", owned_tournaments: [] },
          { status: 200 }
        )
      ),
      http.get("*/auth/me", () =>
        HttpResponse.json(
          {
            id: "user-1",
            email: "jane@example.com",
            display_name: "Jane Doe",
            avatar_url: "https://example.com/avatar.png",
          },
          { status: 200 }
        )
      )
    )
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(result.current.userId).toBe("user-1")
    expect(result.current.displayName).toBe("Jane Doe")
    expect(result.current.email).toBe("jane@example.com")
    expect(result.current.avatarUrl).toBe("https://example.com/avatar.png")
    expect(result.current.isAdmin).toBe(false)
  })

  it("stays unauthenticated when /v1/me succeeds but /auth/me fails", async () => {
    server.use(
      http.get("*/v1/me", () =>
        HttpResponse.json(
          { user_id: "user-1", owned_tournaments: [] },
          { status: 200 }
        )
      ),
      http.get("*/auth/me", () =>
        HttpResponse.json({ detail: "Not authenticated" }, { status: 401 })
      )
    )
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
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
      ),
      http.get("*/auth/me", () =>
        HttpResponse.json(
          {
            id: "user-1",
            email: "jane@example.com",
            display_name: "Jane Doe",
            avatar_url: null,
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
      ),
      http.get("*/auth/me", () =>
        HttpResponse.json(
          {
            id: "user-1",
            email: "jane@example.com",
            display_name: "Jane Doe",
            avatar_url: null,
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
