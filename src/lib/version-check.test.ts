import { afterEach, describe, expect, it, vi } from "vitest"

import { checkForUpdate, fetchDeployedVersion } from "@/lib/version-check"

// Mirrors the sessionStorage key the module writes — pre-seeding it simulates a
// tab that has just reloaded toward a given target version.
const RELOAD_MARK_KEY = "versionReloadAt"

const FIXED_NOW = 1_000_000

/** Deps with sensible defaults; override per case. `now` is fixed for the guard. */
function deps(
  over: Partial<Parameters<typeof checkForUpdate>[0]> = {}
): Parameters<typeof checkForUpdate>[0] {
  return {
    current: "sha-current",
    fetchVersion: () => Promise.resolve("sha-current"),
    reload: vi.fn(),
    isHidden: () => false,
    now: () => FIXED_NOW,
    ...over,
  }
}

describe("checkForUpdate", () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("is a no-op when the deployed build matches the running one", async () => {
    const reload = vi.fn()
    const result = await checkForUpdate(
      deps({ fetchVersion: () => Promise.resolve("sha-current"), reload })
    )

    expect(result).toEqual({ status: "current" })
    expect(reload).not.toHaveBeenCalled()
  })

  it("is a no-op when the manifest is unreachable", async () => {
    const reload = vi.fn()
    const result = await checkForUpdate(
      deps({ fetchVersion: () => Promise.resolve(null), reload })
    )

    expect(result).toEqual({ status: "unknown" })
    expect(reload).not.toHaveBeenCalled()
  })

  it("reloads a hidden tab immediately on a newer build", async () => {
    const reload = vi.fn()
    const result = await checkForUpdate(
      deps({
        fetchVersion: () => Promise.resolve("sha-new"),
        isHidden: () => true,
        reload,
      })
    )

    expect(result).toEqual({ status: "reloaded", deployed: "sha-new" })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("records the target version it reloaded toward (loop guard)", async () => {
    const reload = vi.fn()
    await checkForUpdate(
      deps({
        fetchVersion: () => Promise.resolve("sha-new"),
        isHidden: () => true,
        reload,
      })
    )

    expect(JSON.parse(sessionStorage.getItem(RELOAD_MARK_KEY)!)).toEqual({
      v: "sha-new",
      t: FIXED_NOW,
    })
  })

  it("does not reload a foreground tab — it reports update-available", async () => {
    const reload = vi.fn()
    const result = await checkForUpdate(
      deps({
        fetchVersion: () => Promise.resolve("sha-new"),
        isHidden: () => false,
        reload,
      })
    )

    expect(result).toEqual({ status: "update-available", deployed: "sha-new" })
    expect(reload).not.toHaveBeenCalled()
  })

  it("does not loop: skips a reload for a target it just reloaded toward", async () => {
    sessionStorage.setItem(
      RELOAD_MARK_KEY,
      JSON.stringify({ v: "sha-new", t: FIXED_NOW })
    )
    const reload = vi.fn()

    const result = await checkForUpdate(
      deps({
        fetchVersion: () => Promise.resolve("sha-new"),
        isHidden: () => true,
        reload,
        now: () => FIXED_NOW + 5_000, // within the 60s guard window
      })
    )

    expect(result).toEqual({ status: "skipped", deployed: "sha-new" })
    expect(reload).not.toHaveBeenCalled()
  })

  it("reloads again once the guard window has passed", async () => {
    sessionStorage.setItem(
      RELOAD_MARK_KEY,
      JSON.stringify({ v: "sha-new", t: FIXED_NOW })
    )
    const reload = vi.fn()

    const result = await checkForUpdate(
      deps({
        fetchVersion: () => Promise.resolve("sha-new"),
        isHidden: () => true,
        reload,
        now: () => FIXED_NOW + 61_000, // past the 60s guard window
      })
    )

    expect(result).toEqual({ status: "reloaded", deployed: "sha-new" })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("does not let a stale guard for one version block a different new build", async () => {
    sessionStorage.setItem(
      RELOAD_MARK_KEY,
      JSON.stringify({ v: "sha-old-target", t: FIXED_NOW })
    )
    const reload = vi.fn()

    const result = await checkForUpdate(
      deps({
        fetchVersion: () => Promise.resolve("sha-newer"),
        isHidden: () => true,
        reload,
        now: () => FIXED_NOW + 1_000, // still in the window, but different target
      })
    )

    expect(result).toEqual({ status: "reloaded", deployed: "sha-newer" })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe("fetchDeployedVersion", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns the version string from a well-formed manifest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "abc123" }),
        })
      )
    )

    await expect(fetchDeployedVersion()).resolves.toBe("abc123")
  })

  it("returns null on a non-OK response (e.g. SPA-shell fallback)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      )
    )

    await expect(fetchDeployedVersion()).resolves.toBeNull()
  })

  it("returns null when the body has no usable version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "" }),
        })
      )
    )

    await expect(fetchDeployedVersion()).resolves.toBeNull()
  })

  it("returns null when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network")))
    )

    await expect(fetchDeployedVersion()).resolves.toBeNull()
  })
})
