import { afterEach, describe, expect, it } from "vitest"

import {
  getSessionStored,
  getStored,
  removeStored,
  setSessionStored,
  setStored,
} from "@/lib/safe-storage"

/**
 * The two real-world failure modes from #319, reproduced in jsdom:
 *
 * - **mode P** — `window.localStorage` is `null` (Android WebView with DOM
 *   storage disabled). Any `.getItem` deref throws a `TypeError`.
 * - **mode M** — the object exists but every access throws a `SecurityError`
 *   (sandboxed / cookie-blocked context).
 *
 * `try/catch` must cover both; optional chaining would only cover mode P.
 */
function throwingStorage(): Storage {
  const denied = (): never => {
    throw new DOMException(
      "Access is denied for this document.",
      "SecurityError"
    )
  }
  return {
    length: 0,
    clear: denied,
    getItem: denied,
    key: denied,
    removeItem: denied,
    setItem: denied,
  } as Storage
}

// Captured before any test swaps these for a hostile stub, so afterEach can
// always restore a working backend for the rest of the suite.
const realLocalStorage = window.localStorage
const realSessionStorage = window.sessionStorage

function setLocalStorage(value: unknown) {
  Object.defineProperty(window, "localStorage", { configurable: true, value })
}

function setSessionStorage(value: unknown) {
  Object.defineProperty(window, "sessionStorage", { configurable: true, value })
}

afterEach(() => {
  setLocalStorage(realLocalStorage)
  setSessionStorage(realSessionStorage)
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("safe-storage — localStorage available", () => {
  it("round-trips a value through set/get/remove", () => {
    setStored("k", "v")
    expect(getStored("k")).toBe("v")
    removeStored("k")
    expect(getStored("k")).toBeNull()
  })

  it("returns null for a missing key", () => {
    expect(getStored("absent")).toBeNull()
  })
})

describe("safe-storage — localStorage is null (mode P)", () => {
  afterEach(() => setLocalStorage(realLocalStorage))

  it("getStored returns null instead of throwing", () => {
    setLocalStorage(null)
    expect(() => getStored("k")).not.toThrow()
    expect(getStored("k")).toBeNull()
  })

  it("setStored and removeStored are silent no-ops", () => {
    setLocalStorage(null)
    expect(() => setStored("k", "v")).not.toThrow()
    expect(() => removeStored("k")).not.toThrow()
  })
})

describe("safe-storage — localStorage access throws (mode M)", () => {
  afterEach(() => setLocalStorage(realLocalStorage))

  it("getStored swallows the SecurityError and returns null", () => {
    setLocalStorage(throwingStorage())
    expect(() => getStored("k")).not.toThrow()
    expect(getStored("k")).toBeNull()
  })

  it("setStored and removeStored swallow the SecurityError", () => {
    setLocalStorage(throwingStorage())
    expect(() => setStored("k", "v")).not.toThrow()
    expect(() => removeStored("k")).not.toThrow()
  })
})

describe("safe-storage — sessionStorage variants", () => {
  it("round-trips a value when available", () => {
    setSessionStored("k", "v")
    expect(getSessionStored("k")).toBe("v")
  })

  it("degrade to null / no-op when sessionStorage is null (mode P)", () => {
    setSessionStorage(null)
    expect(getSessionStored("k")).toBeNull()
    expect(() => setSessionStored("k", "v")).not.toThrow()
  })

  it("degrade to null / no-op when access throws (mode M)", () => {
    setSessionStorage(throwingStorage())
    expect(getSessionStored("k")).toBeNull()
    expect(() => setSessionStored("k", "v")).not.toThrow()
  })
})
