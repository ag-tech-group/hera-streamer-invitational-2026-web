import { http, HttpResponse, type HttpHandler } from "msw"

/**
 * MSW handler aggregator for tests.
 *
 * Test-specific handlers (e.g., simulating error responses) can be added here
 * or registered per-test via `server.use(...)`. We don't author fake-data
 * handlers for product features — the frontend consumes real endpoints from
 * the sibling API.
 *
 * Defaults set up here are for cross-cutting infra that fires on every page
 * (the auth probe, etc.) so individual tests aren't required to mock them.
 */
export const handlers: HttpHandler[] = [
  // Default: anonymous `/v1/me` — the unauthenticated state. Tests that
  // need to simulate a signed-in user override with `server.use(...)`.
  http.get("*/v1/me", () =>
    HttpResponse.json({ detail: "Not authenticated" }, { status: 401 })
  ),
  // Default: anonymous `/auth/me` on the auth API. Same pattern as
  // above — tests override per-scenario when they need a signed-in user.
  http.get("*/auth/me", () =>
    HttpResponse.json({ detail: "Not authenticated" }, { status: 401 })
  ),
]
