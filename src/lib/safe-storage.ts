/**
 * Web-storage access that never throws.
 *
 * `localStorage` / `sessionStorage` are unexpectedly hostile in the wild, in
 * two distinct ways:
 *
 * - **The property is `null`.** An Android WebView with DOM storage disabled
 *   (the platform default) exposes `window.localStorage` as `null` — so a bare
 *   `localStorage.getItem(...)` throws `TypeError: …reading 'getItem'`. This is
 *   what in-app browsers (Discord, Twitch, …) and native WebView wrappers ship.
 * - **The property exists but throws on access.** Sandboxed iframes and
 *   cookie-blocked / third-party contexts raise a `SecurityError` from the
 *   accessor itself.
 *
 * Optional chaining (`localStorage?.getItem(...)`) only covers the first case;
 * the throw-on-access case needs a real `try/catch`. These helpers wrap both so
 * callers can treat web storage as best-effort: reads fall back to `null`,
 * writes silently skip persistence. See #319 — the unguarded read in
 * `ThemeProvider`'s `useState` initializer ran on the render path and
 * white-screened the whole `/kings-gauntlet` app in these contexts.
 */

export function getStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (null in a WebView, access denied in a sandboxed
    // context) — persistence is best-effort, so skip silently.
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // See setStored — best-effort, skip silently.
  }
}

export function getSessionStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function setSessionStored(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // See setStored — best-effort, skip silently.
  }
}
