import { Link } from "@tanstack/react-router"
import { ChevronDown, ExternalLink, LogOut, ShieldUser } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import { useTournament } from "@/hooks/use-tournament"
import { useAuth } from "@/lib/auth"
import { AUTH_URL, loginUrl } from "@/lib/auth-config"

/**
 * Top-level app shell navbar — fixed to the top of the viewport on
 * every route. Carries the brand (logo + "Live Standings") with the
 * active tournament name as an eyebrow chip beside it on the left,
 * and the theme toggle + auth widget on the right; page-level headers
 * below shouldn't compete for that space.
 *
 * Layout mirrors criticalbit-web's `Navbar`: full-width translucent
 * bar (`bg-background/80` + `backdrop-blur-sm`), `h-14`, content
 * constrained to the same `max-w-[1536px]` as the rest of the app's
 * page chrome. Routes' content wrappers add `pt-14` to clear the
 * fixed bar.
 */
export function Navbar() {
  // Shares the cache entry with HomePage's own useTournament() call — both
  // hit the same query key, so the navbar piggybacks on whichever fetch
  // resolves first and re-renders when the name arrives.
  const tournament = useTournament()
  const tournamentName = tournament.data?.name ?? null

  return (
    <nav className="border-border/50 bg-background/80 fixed top-0 z-50 w-full border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1536px] items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            aria-label="Live Standings"
          >
            <img src="/logo.png" alt="" className="size-8 shrink-0" />
            <span className="font-display hidden text-lg tracking-wide sm:inline">
              Live Standings
            </span>
          </Link>
          {tournamentName ? (
            <>
              <span
                aria-hidden
                className="bg-border hidden h-5 w-px shrink-0 sm:inline-block"
              />
              <span className="text-muted-foreground hidden truncate text-xs font-medium tracking-widest uppercase sm:inline">
                {tournamentName}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AuthWidget />
        </div>
      </div>
    </nav>
  )
}

/**
 * The right-side auth widget. Three states:
 * - **Loading**: render nothing (no flash of sign-in then sign-out).
 * - **Unauthenticated**: outline Sign in button linking to the shared
 *   auth frontend, with the current pathname as the post-auth redirect.
 *   Matches the criticalbit-web / vagrant-story-web pattern — plain
 *   "Sign in" text, no icon, visible at every breakpoint.
 * - **Authenticated**: DropdownMenu trigger showing the user's avatar
 *   + display_name (or email / user_id as fallback) + chevron. Items:
 *   Profile (external link to auth.criticalbit.gg/profile), Admin
 *   (only when `isAdmin`), Sign out.
 */
function AuthWidget() {
  const {
    isLoading,
    isAuthenticated,
    isAdmin,
    displayName,
    email,
    userId,
    avatarUrl,
    signOut,
  } = useAuth()

  if (isLoading) return null

  if (!isAuthenticated) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={loginUrl(window.location.pathname)}>Sign in</a>
      </Button>
    )
  }

  // Same identity-fallback chain as the owners list: prefer display_name,
  // then email, then the bare user_id as a last resort if the auth API
  // call somehow returned without identity fields.
  const label = displayName ?? email ?? userId ?? "Profile"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors"
          aria-label="Account menu"
        >
          <UserAvatar
            avatarUrl={avatarUrl}
            email={email}
            displayName={displayName}
          />
          <span className="hidden max-w-[160px] truncate sm:inline">
            {label}
          </span>
          <ChevronDown className="text-muted-foreground size-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <a
            href={`${AUTH_URL}/profile`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-4" aria-hidden />
            Profile
          </a>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <ShieldUser className="size-4" aria-hidden />
              Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
