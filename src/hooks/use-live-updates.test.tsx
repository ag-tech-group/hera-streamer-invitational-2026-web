import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { getGetLiveV1TournamentsTournamentSlugLiveGetQueryKey } from "@/api/generated/hooks/live/live"
import { getGetStandingsV1TournamentsTournamentSlugStandingsGetQueryKey } from "@/api/generated/hooks/tournaments/tournaments"
import { activeTournament } from "@/config/tournaments"
import { useLiveUpdates } from "@/hooks/use-live-updates"
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

describe("useLiveUpdates", () => {
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

  it("invalidates the live query on a 'live' nudge", () => {
    const { invalidateSpy } = renderUseLiveUpdates()

    MockEventSource.last().emit("live", { polled_at: "2026-05-21T00:00:00Z" })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetLiveV1TournamentsTournamentSlugLiveGetQueryKey(
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
})
