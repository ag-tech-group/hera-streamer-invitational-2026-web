import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { getMeV1MeGet } from "@/api/generated/hooks/me/me"
import { activeTournament } from "@/config/tournaments"
import { logoutFromAuthApi } from "@/lib/auth-config"

/**
 * Auth state derived from a single probe against `GET /v1/me` at app
 * boot. The endpoint returns the current user's id plus every tournament
 * they own; we derive `isAdmin` for *this* build's tournament by matching
 * `activeTournament.apiTournamentSlug` against the returned ownership
 * list. A 401 means the user isn't signed in — we clear state and the
 * SPA renders the public surface only.
 */
interface AuthContextValue {
  /** True after a successful /v1/me probe; false otherwise (including 401). */
  isAuthenticated: boolean
  /** True while the initial probe is in flight. UI should defer gating decisions until this is false. */
  isLoading: boolean
  /** The criticalbit user UUID, or null when unauthenticated. */
  userId: string | null
  /**
   * True when the current user owns the active tournament — the gate for
   * the admin entry point. Stays false for signed-in non-admins so the
   * admin link / route remain DOM-absent for them (see #80).
   */
  isAdmin: boolean
  /**
   * Re-fetch /v1/me. Call after the SPA reloads following the auth
   * frontend redirect, or before a write the user might be expected to
   * have permission for.
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
  const [ownedSlugs, setOwnedSlugs] = useState<Set<string>>(() => new Set())
  const [isLoading, setIsLoading] = useState(true)

  const clearAuthFields = useCallback(() => {
    // Intentionally does NOT touch the React Query cache: the initial
    // probe's 401 path runs alongside other in-flight queries (e.g. the
    // standings GET), and clearing the cache here would cancel them.
    // `signOut` does the full clear via `window.location.reload()`.
    setIsAuthenticated(false)
    setUserId(null)
    setOwnedSlugs(new Set())
  }, [])

  const refresh = useCallback(async () => {
    try {
      const response = await getMeV1MeGet()
      if (response.status !== 200) {
        clearAuthFields()
        return
      }
      const me = response.data
      setIsAuthenticated(true)
      setUserId(me.user_id)
      setOwnedSlugs(new Set(me.owned_tournaments.map((t) => t.slug)))
    } catch {
      // ky throws on non-2xx (the 401 path here) and on network failures.
      // Either way: drop to the public/unauthenticated state.
      clearAuthFields()
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
    window.location.reload()
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      userId,
      isAdmin: ownedSlugs.has(activeTournament.apiTournamentSlug),
      refresh,
      signOut,
    }),
    [isAuthenticated, isLoading, userId, ownedSlugs, refresh, signOut]
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
