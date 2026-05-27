import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { setOnUnauthorized } from "@/api/api"
import { getMeV1MeGet } from "@/api/generated/hooks/me/me"
import { activeTournament } from "@/config/tournaments"
import { AUTH_URL, getAuthMe, logoutFromAuthApi } from "@/lib/auth-config"

/**
 * localStorage flag set the first time `/v1/me` + `/auth/me` succeed,
 * cleared on signout. The boot-time `refresh()` skips both probes when
 * the flag is absent (and the user isn't arriving from the auth origin),
 * so first-time / never-signed-in visitors don't trip a "Failed to load
 * resource: 401" console error on every page load — see #134.
 */
const AUTH_HINT_KEY = "criticalbit_auth_hint"

/**
 * Auth state derived from a single probe against `GET /v1/me` at app
 * boot. The endpoint returns the current user's id plus every tournament
 * they own; we derive `isAdmin` for *this* build's tournament by matching
 * `activeTournament.apiTournamentSlug` against the returned ownership
 * list. A 401 means the user isn't signed in — we clear state and the
 * SPA renders the public surface only.
 */
interface AuthContextValue {
  /** True after both /v1/me and /auth/me succeed; false otherwise. */
  isAuthenticated: boolean
  /** True while the initial probe is in flight. UI should defer gating decisions until this is false. */
  isLoading: boolean
  /** The criticalbit user UUID, or null when unauthenticated. */
  userId: string | null
  /**
   * Display name from `/auth/me`. Set automatically for Steam / Google
   * OAuth users; null otherwise unless the user filled it in on their
   * auth.criticalbit.gg profile.
   */
  displayName: string | null
  /**
   * Email from `/auth/me`. Null for Steam-OAuth users who haven't yet
   * supplied a real email via the accept-tos gate (auth-api #31).
   */
  email: string | null
  /** Avatar URL from `/auth/me`, or null when unset. */
  avatarUrl: string | null
  /**
   * True when the current user owns the active tournament — the gate for
   * the admin entry point. Stays false for signed-in non-admins so the
   * admin link / route remain DOM-absent for them (see #80).
   */
  isAdmin: boolean
  /**
   * Re-fetch both identity probes. Call after the SPA reloads following
   * the auth frontend redirect, or before a write the user might be
   * expected to have permission for.
   */
  refresh: () => Promise<void>
  /**
   * Cross-origin POST to the auth API's logout endpoint, then a full
   * reload so every cached query (and any in-flight component state)
   * starts fresh against the now-anonymous session.
   */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [ownedSlugs, setOwnedSlugs] = useState<Set<string>>(() => new Set())
  const [isLoading, setIsLoading] = useState(true)

  const clearAuthFields = useCallback(() => {
    // Intentionally does NOT touch the React Query cache: the initial
    // probe's 401 path runs alongside other in-flight queries (e.g. the
    // standings GET), and clearing the cache here would cancel them.
    // `signOut` does the full clear via `window.location.reload()`.
    setIsAuthenticated(false)
    setUserId(null)
    setDisplayName(null)
    setEmail(null)
    setAvatarUrl(null)
    setOwnedSlugs(new Set())
  }, [])

  const refresh = useCallback(async () => {
    try {
      // Both probes in parallel — same auth cookie satisfies both, and
      // doing them concurrently shaves a roundtrip off boot time.
      const [meResponse, authMe] = await Promise.all([
        getMeV1MeGet(),
        getAuthMe(),
      ])

      if (meResponse.status !== 200 || !authMe) {
        clearAuthFields()
        clearAuthHint()
        return
      }
      const me = meResponse.data
      setAuthHint()
      setIsAuthenticated(true)
      setUserId(me.user_id)
      setOwnedSlugs(new Set(me.owned_tournaments.map((t) => t.slug)))
      setDisplayName(authMe.display_name)
      setEmail(authMe.email)
      setAvatarUrl(authMe.avatar_url)
    } catch {
      // ky throws on non-2xx (the 401 path here) and on network failures.
      // Either way: drop to the public/unauthenticated state and clear
      // the hint so the next page load doesn't try the probe again.
      clearAuthFields()
      clearAuthHint()
    } finally {
      setIsLoading(false)
    }
  }, [clearAuthFields])

  const signOut = useCallback(async () => {
    try {
      await logoutFromAuthApi()
    } catch {
      // Even on logout-endpoint failure (network drop, CORS misconfig),
      // reload the page to drop in-memory state — the cookie may have
      // been cleared anyway, and reloading is the simplest "make
      // everything anonymous" gesture.
    }
    // Clear the auth hint so the post-reload boot skips the probes
    // and renders the public surface without firing a guaranteed 401.
    clearAuthHint()
    window.location.reload()
  }, [])

  useEffect(() => {
    // Boot-time probe gate (#134): skip the auth requests entirely when
    // there's no signal this browser has ever authenticated with us —
    // they'd just yield 401s that the browser logs as console errors
    // for every never-signed-in visitor. The hint is set on a successful
    // `refresh` and cleared on signout / 401 / refresh failure. The
    // auth-origin referrer check covers the first-page-load-after-sign-in
    // case where the hint hasn't been set yet but the user just came
    // through a real sign-in flow.
    //
    // The gate intentionally lives here rather than inside `refresh`
    // itself so explicit `refresh()` callers (post-redirect handshake,
    // pre-write permission checks, etc.) always re-probe regardless of
    // the hint state.
    if (!hasAuthHint() && !cameFromAuthOrigin()) {
      clearAuthFields()
      setIsLoading(false)
      return
    }
    void refresh()
  }, [refresh, clearAuthFields])

  // Subscribe to permanently-401 responses from anywhere in the app
  // (any standings API call whose refresh attempt also failed). When
  // that happens we mirror the server's view by clearing the cached
  // auth fields — otherwise the UI would keep claiming the user is
  // signed in after their session has actually expired.
  useEffect(() => {
    setOnUnauthorized(() => {
      clearAuthFields()
      // Mid-session 401 (expired token, refresh failed): clear the hint
      // so the next page load goes through the public-visitor skip path
      // instead of immediately re-probing and re-logging the same 401.
      clearAuthHint()
      setIsLoading(false)
    })
    return () => setOnUnauthorized(null)
  }, [clearAuthFields])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      userId,
      displayName,
      email,
      avatarUrl,
      isAdmin: ownedSlugs.has(activeTournament.apiTournamentSlug),
      refresh,
      signOut,
    }),
    [
      isAuthenticated,
      isLoading,
      userId,
      displayName,
      email,
      avatarUrl,
      ownedSlugs,
      refresh,
      signOut,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Read the auth state from context. Throws when used outside `AuthProvider`
 * to surface wiring mistakes loudly at dev-time rather than silently
 * falling back to a default unauthenticated state.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}

function hasAuthHint(): boolean {
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem(AUTH_HINT_KEY) !== null
  )
}

function setAuthHint(): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(AUTH_HINT_KEY, "1")
}

function clearAuthHint(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(AUTH_HINT_KEY)
}

/**
 * Did the user arrive via the criticalbit auth frontend? Used to fire
 * the auth probes on the first page load following a sign-in flow even
 * when the localStorage hint hasn't been set yet (e.g. private-browsing
 * mode, or first-ever sign-in on this device). Guarded against the
 * empty / opaque referrer that Referrer-Policy may produce.
 */
function cameFromAuthOrigin(): boolean {
  if (typeof document === "undefined" || !document.referrer) return false
  try {
    return new URL(document.referrer).hostname === new URL(AUTH_URL).hostname
  } catch {
    return false
  }
}
