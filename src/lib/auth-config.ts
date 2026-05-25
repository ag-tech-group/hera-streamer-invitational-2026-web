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
