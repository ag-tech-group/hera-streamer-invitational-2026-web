import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getGetStandingsV1TournamentsTournamentSlugStandingsGetQueryKey,
  getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey,
  getGetTournamentDetailV1TournamentsTournamentSlugGetQueryKey,
} from "@/api/generated/hooks/tournaments/tournaments"
import { activeTournament } from "@/config/tournaments"
import { useLiveUpdates } from "@/hooks/use-live-updates"
import { logger } from "@/lib/logger"
import { MockEventSource } from "@/test/mock-event-source"

function renderUseLiveUpdates() {
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
  const view = renderHook(() => useLiveUpdates(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
  return { ...view, invalidateSpy }
}

// jsdom defaults document.visibilityState to "visible". These drive the Page
// Visibility API the hook keys off (#285): `setVisibility` flips the state and
// fires the event a real browser would; `resetVisibility` restores the default
// after each test so state never leaks between them.
function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  })
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => state === "hidden",
  })
  document.dispatchEvent(new Event("visibilitychange"))
}

function resetVisibility(): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  })
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => false,
  })
}

describe("useLiveUpdates", () => {
  afterEach(() => {
    vi.useRealTimers()
    resetVisibility()
  })

  it("opens an SSE connection to the stream endpoint", () => {
    renderUseLiveUpdates()
    expect(MockEventSource.last().url).toMatch(/\/v1\/stream$/)
  })

  it("invalidates the standings query on a 'standings' nudge", () => {
    const { invalidateSpy } = renderUseLiveUpdates()

    MockEventSource.last().emit("standings", {
      polled_at: "2026-05-21T00:00:00Z",
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetStandingsV1TournamentsTournamentSlugStandingsGetQueryKey(
        activeTournament.apiTournamentSlug
      ),
    })
  })

  it("invalidates the team standings query on a 'standings' nudge", () => {
    const { invalidateSpy } = renderUseLiveUpdates()

    MockEventSource.last().emit("standings", {
      polled_at: "2026-05-21T00:00:00Z",
    })

    // Team combined ratings derive from player ratings, so a standings poll
    // refreshes the team standings too.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey:
        getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey(
          activeTournament.apiTournamentSlug
        ),
    })
  })

  it("invalidates the standings query on a 'live' nudge", () => {
    const { invalidateSpy } = renderUseLiveUpdates()

    MockEventSource.last().emit("live", { polled_at: "2026-05-21T00:00:00Z" })

    // A `live` nudge changes a player's `in_match`, which the standings
    // endpoint folds into each row — so it refreshes the standings query.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetStandingsV1TournamentsTournamentSlugStandingsGetQueryKey(
        activeTournament.apiTournamentSlug
      ),
    })
  })

  it("invalidates the tournament query on a 'live' nudge", () => {
    const { invalidateSpy } = renderUseLiveUpdates()

    MockEventSource.last().emit("live", { polled_at: "2026-05-21T00:00:00Z" })

    // A `live` nudge also carries the host's `host_stream_live` (a derived
    // flag on the tournament record, #149), so the tournament-detail query
    // refreshes too — that's what lights up the host card without a reload.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetTournamentDetailV1TournamentsTournamentSlugGetQueryKey(
        activeTournament.apiTournamentSlug
      ),
    })
  })

  it("closes the connection on unmount", () => {
    const { unmount } = renderUseLiveUpdates()
    const source = MockEventSource.last()

    unmount()

    expect(source.close).toHaveBeenCalledOnce()
  })

  it("swallows an aborted invalidation instead of leaking an unhandled rejection", async () => {
    const queryClient = new QueryClient()
    // A nudge that invalidates a query whose refetch is in flight makes React
    // Query abort that request; the returned promise rejects with AbortError.
    const abort = new DOMException("Fetch is aborted", "AbortError")
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(() =>
      Promise.reject(abort)
    )
    const debugSpy = vi.spyOn(logger, "debug")

    renderHook(() => useLiveUpdates(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    })

    MockEventSource.last().emit("standings", {
      polled_at: "2026-05-21T00:00:00Z",
    })

    // Let the rejected invalidation settle; the hook's `.catch` should handle
    // it — if it didn't, this would surface as an unhandled rejection.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(debugSpy).toHaveBeenCalledWith(
      "SSE-triggered invalidation rejected",
      expect.objectContaining({ error: abort })
    )
  })

  it("keeps the connection through a brief hide within the grace period", () => {
    vi.useFakeTimers()
    renderUseLiveUpdates()
    const source = MockEventSource.last()

    setVisibility("hidden")
    // Well under any reasonable grace window — a quick tab-flip.
    vi.advanceTimersByTime(1_000)
    setVisibility("visible")

    // The original connection was never dropped, so there's no reconnect.
    expect(source.close).not.toHaveBeenCalled()
    expect(MockEventSource.instances).toHaveLength(1)
  })

  it("drops the connection after the tab stays hidden past the grace period", () => {
    vi.useFakeTimers()
    renderUseLiveUpdates()
    const source = MockEventSource.last()

    setVisibility("hidden")
    // Far past any reasonable grace window — an abandoned background tab.
    vi.advanceTimersByTime(5 * 60_000)

    expect(source.close).toHaveBeenCalledOnce()
  })

  it("reopens and refetches to catch up when the tab returns after being dropped", () => {
    vi.useFakeTimers()
    const { invalidateSpy } = renderUseLiveUpdates()
    expect(MockEventSource.instances).toHaveLength(1)

    setVisibility("hidden")
    vi.advanceTimersByTime(5 * 60_000)
    invalidateSpy.mockClear()

    setVisibility("visible")

    // A fresh connection replaces the dropped one...
    expect(MockEventSource.instances).toHaveLength(2)
    // ...and a standings refetch catches up on anything missed while away.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetStandingsV1TournamentsTournamentSlugStandingsGetQueryKey(
        activeTournament.apiTournamentSlug
      ),
    })
  })

  it("does not open a connection while mounted in a hidden tab, until it becomes visible", () => {
    setVisibility("hidden")

    const { invalidateSpy } = renderUseLiveUpdates()
    // Never hold a server seat for a tab the user hasn't looked at.
    expect(MockEventSource.instances).toHaveLength(0)

    setVisibility("visible")

    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.last().url).toMatch(/\/v1\/stream$/)
    // First reveal connects and catches up.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetStandingsV1TournamentsTournamentSlugStandingsGetQueryKey(
        activeTournament.apiTournamentSlug
      ),
    })
  })
})
