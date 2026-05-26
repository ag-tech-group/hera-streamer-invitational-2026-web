import { handlers } from "@/api/handlers"
// Side-effect import: bootstraps i18next so components rendered in
// tests get real translations (English by default) instead of falling
// through to raw key strings.
import "@/lib/i18n"
import { MockEventSource } from "@/test/mock-event-source"
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, vi } from "vitest"

/**
 * Shared MSW server. Tests register per-scenario handlers with `server.use(...)`
 * (cleared after each test); see `src/api/handlers.ts` for the convention.
 */
export const server = setupServer(...handlers)

// Fail tests that hit an unmocked endpoint rather than letting them reach the
// real network — keeps the suite deterministic and offline.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  cleanup()
  MockEventSource.reset()
})

// Mock window.scrollTo
window.scrollTo = vi.fn()

// Mock Element.prototype.scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = ResizeObserverMock

// Mock IntersectionObserver
class IntersectionObserverMock {
  readonly root: Element | null = null
  readonly rootMargin: string = ""
  readonly thresholds: ReadonlyArray<number> = []
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn().mockReturnValue([])
}
global.IntersectionObserver = IntersectionObserverMock

// Mock URL.createObjectURL and URL.revokeObjectURL
URL.createObjectURL = vi.fn(() => "blob:mock-url")
URL.revokeObjectURL = vi.fn()

// Mock EventSource — jsdom has none, and the SSE hook (useLiveUpdates) would
// otherwise open a real connection. See src/test/mock-event-source.ts.
global.EventSource = MockEventSource as unknown as typeof EventSource
