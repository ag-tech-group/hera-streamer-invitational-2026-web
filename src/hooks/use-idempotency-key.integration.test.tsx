import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { useAddRosterPlayerV1TournamentsTournamentSlugPlayersPost } from "@/api/generated/hooks/players/players"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { server } from "@/test/setup"

/**
 * End-to-end check of the idempotency-key contract from #71:
 * a user-initiated retry of the same logical operation reuses the same
 * `Idempotency-Key` so the backend can replay its cached response. After
 * a successful submission, the key advances — the next operation gets a
 * fresh key.
 *
 * Exercises the whole chain: `useIdempotencyKey` → orval mutation hook →
 * `orvalClient` → `ky`. A failure anywhere in that chain (dropped
 * header, regenerated key, stale closure) breaks this test.
 */

const TOURNAMENT_SLUG = "default"
// Wildcard prefix so the handler matches regardless of `VITE_API_URL` in
// the test environment — the orval-generated MSW handlers use the same
// pattern.
const ADD_PLAYER_URL = `*/v1/tournaments/${TOURNAMENT_SLUG}/players`

/**
 * Minimal test harness: wires the idempotency hook to a real mutation
 * hook, surfaces a submit button, and shows the latest status so tests
 * can wait on it.
 */
function AddPlayerHarness() {
  const idempotencyKey = useIdempotencyKey()
  const mutation = useAddRosterPlayerV1TournamentsTournamentSlugPlayersPost({
    request: {
      headers: { "Idempotency-Key": idempotencyKey.current },
    },
    mutation: {
      onSuccess: () => idempotencyKey.reset(),
    },
  })

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          mutation.mutate({
            tournamentSlug: TOURNAMENT_SLUG,
            data: { profile_id: 12345 },
          })
        }
      >
        submit
      </button>
      <span data-testid="status">
        {mutation.isPending
          ? "pending"
          : mutation.isError
            ? "error"
            : mutation.isSuccess
              ? "success"
              : "idle"}
      </span>
    </div>
  )
}

function renderHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AddPlayerHarness />
    </QueryClientProvider>
  )
}

describe("idempotency key end-to-end", () => {
  it("reuses the same key when the user retries a failed submission", async () => {
    // Capture the Idempotency-Key on every request. First attempt fails
    // with a 500 (server committed but client never sees the response —
    // the case idempotency keys exist for); second attempt succeeds.
    const seenKeys: string[] = []
    let callCount = 0
    server.use(
      http.post(ADD_PLAYER_URL, ({ request }) => {
        seenKeys.push(request.headers.get("Idempotency-Key") ?? "")
        callCount += 1
        if (callCount === 1) {
          return new HttpResponse(null, { status: 500 })
        }
        return HttpResponse.json({}, { status: 201 })
      })
    )

    const user = userEvent.setup()
    renderHarness()

    // First attempt → fails.
    await user.click(screen.getByText("submit"))
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("error")
    )

    // Second attempt (user-initiated retry) → succeeds.
    await user.click(screen.getByText("submit"))
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success")
    )

    expect(seenKeys).toHaveLength(2)
    expect(seenKeys[0]).toMatch(/^[0-9a-f-]{36}$/i)
    expect(seenKeys[1]).toBe(seenKeys[0])
  })

  it("advances the key on the next submit after success", async () => {
    const seenKeys: string[] = []
    server.use(
      http.post(ADD_PLAYER_URL, ({ request }) => {
        seenKeys.push(request.headers.get("Idempotency-Key") ?? "")
        return HttpResponse.json({}, { status: 201 })
      })
    )

    const user = userEvent.setup()
    renderHarness()

    await user.click(screen.getByText("submit"))
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success")
    )

    // Let the post-success state flush before the next click so the
    // mutation hook re-renders with the fresh key.
    await act(async () => {
      await Promise.resolve()
    })

    await user.click(screen.getByText("submit"))
    await waitFor(() => expect(seenKeys).toHaveLength(2))
    expect(seenKeys[1]).not.toBe(seenKeys[0])
  })
})
