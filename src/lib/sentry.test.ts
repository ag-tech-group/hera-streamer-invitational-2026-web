import type { ErrorEvent as SentryErrorEvent, EventHint } from "@sentry/react"
import { afterEach, describe, expect, it } from "vitest"

import { shouldSuppressEvent } from "@/lib/sentry"

function errorEvent(type?: string): SentryErrorEvent {
  const exception = type ? { values: [{ type }] } : undefined
  return { exception } as unknown as SentryErrorEvent
}

describe("shouldSuppressEvent", () => {
  afterEach(() => {
    delete window.__chunkReloadInFlight
  })

  it("keeps an ordinary error event", () => {
    expect(shouldSuppressEvent(errorEvent("TypeError"))).toBe(false)
  })

  it("drops everything while a stale-chunk recovery reload is in flight", () => {
    window.__chunkReloadInFlight = true
    expect(shouldSuppressEvent(errorEvent("TypeError"))).toBe(true)
  })

  it("drops an AbortError identified by the exception type", () => {
    // e.g. "AbortError: signal is aborted without reason" from a cancelled fetch
    expect(shouldSuppressEvent(errorEvent("AbortError"))).toBe(true)
  })

  it("drops an AbortError identified by the original exception", () => {
    const hint = {
      originalException: new DOMException("Fetch is aborted", "AbortError"),
    } as EventHint
    // Even when the event's own exception isn't populated.
    expect(shouldSuppressEvent(errorEvent(), hint)).toBe(true)
  })

  it("keeps a non-abort DOMException", () => {
    const hint = {
      originalException: new DOMException("Boom", "InvalidStateError"),
    } as EventHint
    expect(shouldSuppressEvent(errorEvent("InvalidStateError"), hint)).toBe(
      false
    )
  })
})
