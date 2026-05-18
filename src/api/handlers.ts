import { type HttpHandler } from "msw"

/**
 * MSW handler aggregator for tests.
 *
 * Test-specific handlers (e.g., simulating error responses) can be added here
 * or registered per-test via `server.use(...)`. We don't author fake-data
 * handlers for product features — the frontend consumes real endpoints from
 * the sibling API.
 */
export const handlers: HttpHandler[] = []
