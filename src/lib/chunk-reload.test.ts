import { afterEach, describe, expect, it, vi } from "vitest"

import { installChunkReloadHandler } from "@/lib/chunk-reload"

// Mirrors the sessionStorage key the module writes — pre-seeding it simulates a
// document that has just reloaded once already.
const RELOAD_MARK_KEY = "chunkReloadAt"

function firePreloadError(): Event {
  const event = new Event("vite:preloadError", { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe("installChunkReloadHandler", () => {
  let dispose: (() => void) | undefined

  afterEach(() => {
    dispose?.()
    dispose = undefined
    sessionStorage.clear()
    delete window.__chunkReloadInFlight
    vi.restoreAllMocks()
  })

  it("reloads once and swallows the first stale-chunk error", () => {
    const reload = vi.fn()
    dispose = installChunkReloadHandler(reload)

    const event = firePreloadError()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it("does not loop: a second error in the same load is left to surface", () => {
    const reload = vi.fn()
    dispose = installChunkReloadHandler(reload)

    firePreloadError()
    const second = firePreloadError()

    expect(reload).toHaveBeenCalledTimes(1)
    // Not prevented → Vite re-throws → a genuinely broken deploy still reaches Sentry.
    expect(second.defaultPrevented).toBe(false)
  })

  it("does not reload again right after a reload (cross-reload guard)", () => {
    sessionStorage.setItem(RELOAD_MARK_KEY, String(Date.now()))
    const reload = vi.fn()
    dispose = installChunkReloadHandler(reload)

    const event = firePreloadError()

    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it("reloads again once the guard window has passed (a later deploy)", () => {
    sessionStorage.setItem(RELOAD_MARK_KEY, String(Date.now() - 11_000))
    const reload = vi.fn()
    dispose = installChunkReloadHandler(reload)

    firePreloadError()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("flags the teardown window so Sentry can drop the moot reload error", () => {
    const reload = vi.fn()
    dispose = installChunkReloadHandler(reload)
    expect(window.__chunkReloadInFlight).toBeFalsy()

    firePreloadError()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(window.__chunkReloadInFlight).toBe(true)
  })

  it("does not flag the teardown window when the guard suppresses the reload", () => {
    sessionStorage.setItem(RELOAD_MARK_KEY, String(Date.now()))
    const reload = vi.fn()
    dispose = installChunkReloadHandler(reload)

    firePreloadError()

    expect(reload).not.toHaveBeenCalled()
    expect(window.__chunkReloadInFlight).toBeFalsy()
  })

  it("stops handling after the disposer runs", () => {
    const reload = vi.fn()
    installChunkReloadHandler(reload)()

    const event = firePreloadError()

    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})
