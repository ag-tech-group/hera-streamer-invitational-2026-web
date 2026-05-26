import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useIdempotencyKey } from "@/hooks/use-idempotency-key"

/** RFC 4122 v4 shape — used to verify `crypto.randomUUID()` output. */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe("useIdempotencyKey", () => {
  it("returns a valid v4 UUID on initial render", () => {
    const { result } = renderHook(() => useIdempotencyKey())
    expect(result.current.current).toMatch(UUID_V4)
  })

  it("keeps the same key across renders without reset", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey())
    const initialKey = result.current.current
    rerender()
    rerender()
    expect(result.current.current).toBe(initialKey)
  })

  it("returns a fresh key after reset()", () => {
    const { result } = renderHook(() => useIdempotencyKey())
    const initialKey = result.current.current
    act(() => result.current.reset())
    expect(result.current.current).not.toBe(initialKey)
    expect(result.current.current).toMatch(UUID_V4)
  })

  it("gives different hook instances different keys", () => {
    const a = renderHook(() => useIdempotencyKey())
    const b = renderHook(() => useIdempotencyKey())
    expect(a.result.current.current).not.toBe(b.result.current.current)
  })

  it("returns a stable reset reference across renders", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey())
    const initialReset = result.current.reset
    rerender()
    expect(result.current.reset).toBe(initialReset)
  })
})

describe("useIdempotencyKey.resetOnReusedKey", () => {
  /** Build a ky-shaped error with a JSON response body the parser will read. */
  function makeError(status: number, body: unknown): unknown {
    return {
      response: new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    }
  }

  it("advances the key when the server returns `idempotency_key_reused`", async () => {
    const { result } = renderHook(() => useIdempotencyKey())
    const initialKey = result.current.current
    await act(async () => {
      await result.current.resetOnReusedKey(
        makeError(422, {
          error_code: "idempotency_key_reused",
          message: "Same key, different body.",
        })
      )
    })
    await waitFor(() => expect(result.current.current).not.toBe(initialKey))
  })

  it("leaves the key alone for any other error code", async () => {
    const { result } = renderHook(() => useIdempotencyKey())
    const initialKey = result.current.current
    await act(async () => {
      await result.current.resetOnReusedKey(
        makeError(422, {
          error_code: "validation_error",
          message: "Field missing.",
        })
      )
    })
    expect(result.current.current).toBe(initialKey)
  })

  it("leaves the key alone for a network-style error with no response", async () => {
    const { result } = renderHook(() => useIdempotencyKey())
    const initialKey = result.current.current
    await act(async () => {
      await result.current.resetOnReusedKey(new Error("network drop"))
    })
    expect(result.current.current).toBe(initialKey)
  })
})
