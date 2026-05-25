import ky, { type Options } from "ky"

import { AUTH_API_URL } from "@/lib/auth-config"

export const baseUrl = import.meta.env.VITE_API_URL || "/api"

/**
 * Module-level callback for handling permanently-401 responses (refresh
 * has failed and the user genuinely isn't signed in any more). The
 * AuthProvider registers itself via `setOnUnauthorized` so the SPA's
 * cached auth state stays in lock-step with the server's view.
 */
let onUnauthorized: (() => void) | null = null
export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb
}

/**
 * Singleton refresh: concurrent 401s share one in-flight POST to
 * `/auth/refresh` so we never thunder the auth API when several
 * requests fire at the same time and all fail their access token.
 * Returns `true` when the refresh rotated a new access cookie, `false`
 * otherwise (network failure or expired refresh family).
 */
let refreshPromise: Promise<boolean> | null = null
async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${AUTH_API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      return res.status === 204
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export const api = ky.create({
  prefixUrl: baseUrl,
  timeout: 30000,
  // Send the `criticalbit_access` cookie (scoped to `.criticalbit.gg`)
  // on every request so the standings API can identify the current
  // user via `/v1/me` and gate write endpoints by tournament ownership.
  // The API must respond with `Access-Control-Allow-Credentials: true`
  // and a specific origin (not `*`) for these to be accepted.
  credentials: "include",
  // Retries are handled by TanStack React Query
  retry: 0,
  hooks: {
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) return
        // Try to rotate the access token via the refresh cookie. On
        // success, replay the original request once — the new access
        // cookie is automatically attached by `credentials: "include"`.
        // On failure, notify the AuthProvider so the SPA drops to the
        // anonymous state instead of pretending to still be signed in.
        const refreshed = await attemptRefresh()
        if (refreshed) {
          return ky(request)
        }
        onUnauthorized?.()
      },
    ],
  },
})

export type { Options as ApiOptions }
