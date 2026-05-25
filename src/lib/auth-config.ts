/**
 * URLs for the shared criticalbit auth surface.
 *
 * - `AUTH_URL` — the auth FRONTEND (`auth.criticalbit.gg`), where the
 *   user lands for sign-in, profile management, etc. Cross-origin
 *   navigation; bookmarkable.
 * - `AUTH_API_URL` — the auth API (`auth-api.criticalbit.gg`), used for
 *   in-app POSTs like logout. Different from the standings API
 *   (`VITE_API_URL`); the access token is issued by this service and
 *   recognised by both APIs via a shared `*.criticalbit.gg` cookie.
 *
 * Both can be overridden via env vars for local dev (point at
 * `http://localhost:5174` / `http://localhost:8000` etc.).
 */
export const AUTH_URL =
  import.meta.env.VITE_AUTH_URL || "https://auth.criticalbit.gg"

export const AUTH_API_URL =
  import.meta.env.VITE_AUTH_API_URL || "https://auth-api.criticalbit.gg"

/**
 * URL that opens the auth frontend's sign-in flow and returns the user
 * to `redirectPath` on this app's origin after success.
 */
export function loginUrl(redirectPath = "/"): string {
  const redirect = `${window.location.origin}${redirectPath}`
  return `${AUTH_URL}/login?redirect=${encodeURIComponent(redirect)}`
}

/** Profile page URL on the auth frontend (account management, sign-out). */
export function profileUrl(): string {
  return `${AUTH_URL}/profile`
}

/**
 * Cross-origin POST to the auth API's logout endpoint. The auth API
 * deletes the `criticalbit_access` cookie (scoped to `.criticalbit.gg`)
 * and revokes the refresh-token family. CORS allows all
 * `*.criticalbit.gg` subdomains, so this works from any platform app.
 */
export async function logoutFromAuthApi(): Promise<void> {
  await fetch(`${AUTH_API_URL}/auth/jwt/logout`, {
    method: "POST",
    credentials: "include",
  })
}

/**
 * Public identity surface returned by `GET /users/search`. Intentionally
 * minimal — email is matched server-side as an input convenience but
 * never returned, so the type-ahead picker can't accidentally surface
 * other users' email addresses to a curious admin.
 */
export interface UserSearchResult {
  id: string
  display_name: string | null
  avatar_url: string | null
}

/**
 * Identity fields the auth API returns for the currently-signed-in user
 * via `GET /auth/me`. Subset of the auth-api's full `UserRead` schema —
 * we only consume the fields the SPA actually surfaces in the navbar
 * dropdown. `email` is nullable because Steam-OAuth users carry
 * `email=null` until they go through the accept-tos email gate
 * (see [auth-api#31](https://github.com/ag-tech-group/criticalbit-auth-api/issues/31)).
 */
export interface AuthApiMe {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
}

/**
 * Probe the auth API for the current user's identity. Used by
 * `AuthProvider` to populate display_name / email / avatar_url so the
 * navbar can render the auth widget with a proper user identity
 * rather than just a "Sign out" button.
 *
 * Mirrors `searchUsers`' refresh-and-retry shape: a stale access token
 * triggers a single refresh attempt before the failure propagates,
 * matching the ky client's `afterResponse` hook for the standings API.
 * Returns `null` when the call fails for any reason (network drop, 401
 * after refresh failed, etc.) — caller treats `null` as unauthenticated.
 */
export async function getAuthMe(): Promise<AuthApiMe | null> {
  const url = `${AUTH_API_URL}/auth/me`
  const send = () => fetch(url, { credentials: "include" })

  let res = await send()
  if (res.status === 401) {
    const { attemptRefresh } = await import("@/api/api")
    const refreshed = await attemptRefresh()
    if (refreshed) {
      res = await send()
    }
  }
  if (!res.ok) return null
  return res.json()
}

/**
 * Type-ahead user search against the auth API's `/users/search`.
 *
 * Matches case-insensitive against both display_name and email (the
 * email match key is a convenience for admins who know the address;
 * the email itself isn't echoed back). Requires auth — a stale access
 * token triggers a single refresh-and-retry before propagating the
 * failure.
 */
export async function searchUsers(
  q: string,
  limit = 10
): Promise<UserSearchResult[]> {
  const url = new URL(`${AUTH_API_URL}/users/search`)
  url.searchParams.set("q", q)
  url.searchParams.set("limit", String(limit))

  const send = () => fetch(url, { credentials: "include" })

  let res = await send()
  if (res.status === 401) {
    // Lazy import to dodge the api.ts → auth-config.ts → api.ts cycle.
    const { attemptRefresh } = await import("@/api/api")
    const refreshed = await attemptRefresh()
    if (refreshed) {
      res = await send()
    }
  }
  if (!res.ok) {
    throw new Error(`searchUsers failed: ${res.status}`)
  }
  return res.json()
}
