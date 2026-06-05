import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider, useTheme } from "@/components/theme-provider"

/**
 * Regression coverage for #319: `ThemeProvider` reads `localStorage` in its
 * `useState` initializer, which runs *on the render path*. When web storage is
 * unavailable an unguarded read throws during render — and because the provider
 * wraps the whole app, that white-screened `/kings-gauntlet` in WebViews and
 * sandboxed contexts. These tests reproduce both failure modes and assert the
 * provider renders its default theme instead of crashing.
 */

const STORAGE_KEY = "app_theme"

// Captured before any test swaps it for a hostile stub.
const realLocalStorage = window.localStorage

function setLocalStorage(value: unknown) {
  Object.defineProperty(window, "localStorage", { configurable: true, value })
}

// mode M — object exists, but every access throws (sandboxed / cookie-blocked).
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

function ThemeProbe() {
  const { theme, setTheme } = useTheme()
  return (
    <button type="button" data-testid="theme" onClick={() => setTheme("dark")}>
      {theme}
    </button>
  )
}

afterEach(() => {
  setLocalStorage(realLocalStorage)
  window.localStorage.clear()
})

describe("ThemeProvider — web storage unavailable (#319)", () => {
  it("renders the default theme when localStorage is null (WebView, mode P)", () => {
    setLocalStorage(null)
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeProbe />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme")).toHaveTextContent("light")
  })

  it("renders the default theme when storage access throws (sandboxed, mode M)", () => {
    setLocalStorage(throwingStorage())
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeProbe />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme")).toHaveTextContent("dark")
  })

  it("setTheme still updates in-memory state when persistence is a no-op", async () => {
    const user = userEvent.setup()
    setLocalStorage(throwingStorage())
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeProbe />
      </ThemeProvider>
    )
    await user.click(screen.getByTestId("theme"))
    expect(screen.getByTestId("theme")).toHaveTextContent("dark")
  })
})

describe("ThemeProvider — web storage available", () => {
  it("prefers a previously persisted theme over the default", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark")
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeProbe />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme")).toHaveTextContent("dark")
  })

  it("persists the chosen theme to localStorage", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeProbe />
      </ThemeProvider>
    )
    await user.click(screen.getByTestId("theme"))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark")
  })
})
