import { afterEach, describe, expect, it } from "vitest"

import { scrubToolbarLaunchState } from "@/lib/posthog"

// Mirrors the localStorage key posthog-js persists toolbar-launch params
// under after a `#__posthog=` visit.
const TOOLBAR_PARAMS_KEY = "_postHogToolbarParams"

// A real launch payload is percent-encoded JSON; the exact contents don't
// matter to the scrub, only the `__posthog=` key.
const LAUNCH_HASH =
  "#__posthog=%7B%22action%22%3A%22ph_authorize%22%2C%22token%22%3A%22phc_x%22%7D"

describe("scrubToolbarLaunchState", () => {
  afterEach(() => {
    localStorage.clear()
    window.history.replaceState(null, "", "/")
  })

  it("removes persisted toolbar launch params", () => {
    localStorage.setItem(TOOLBAR_PARAMS_KEY, '{"token":"phc_x"}')
    scrubToolbarLaunchState()
    expect(localStorage.getItem(TOOLBAR_PARAMS_KEY)).toBeNull()
  })

  it("strips a #__posthog launch hash from the URL", () => {
    window.history.replaceState(null, "", `/kings-gauntlet/${LAUNCH_HASH}`)
    scrubToolbarLaunchState()
    expect(window.location.hash).toBe("")
    expect(window.location.pathname).toBe("/kings-gauntlet/")
  })

  it("strips a #state auth-return hash", () => {
    window.history.replaceState(null, "", "/kings-gauntlet/#state=abc123")
    scrubToolbarLaunchState()
    expect(window.location.hash).toBe("")
  })

  it("keeps an ordinary in-page anchor", () => {
    // e.g. the stats-page section fragments (#358) must survive the scrub.
    window.history.replaceState(null, "", "/kings-gauntlet/#civ-picks")
    scrubToolbarLaunchState()
    expect(window.location.hash).toBe("#civ-picks")
  })

  it("preserves query string and history state when stripping", () => {
    window.history.replaceState(
      { routerKey: "abc" },
      "",
      `/kings-gauntlet/?utm_source=x${LAUNCH_HASH}`
    )
    scrubToolbarLaunchState()
    expect(window.location.pathname).toBe("/kings-gauntlet/")
    expect(window.location.search).toBe("?utm_source=x")
    expect(window.location.hash).toBe("")
    expect(window.history.state).toEqual({ routerKey: "abc" })
  })
})
