import { Link } from "@tanstack/react-router"
import { ChevronDown, ExternalLink, LogOut, ShieldUser } from "lucide-react"
import { useTranslation } from "react-i18next"

import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import { activeTournament } from "@/config/tournaments"
import { useTournament } from "@/hooks/use-tournament"
import { ARCHIVE_MODE } from "@/lib/archive-mode"
import { useAuth } from "@/lib/auth"
import { AUTH_URL, loginUrl } from "@/lib/auth-config"

/**
 * Top-level app shell navbar — fixed to the top of the viewport on
 * every route. Carries just the logo (linking home) on the left — the
 * tournament name now headlines the standings page itself, so the bar
 * stays a quiet brand mark — with the theme toggle + language toggle +
 * auth widget on the right.
 *
 * Layout mirrors criticalbit-web's `Navbar`: full-width translucent
 * bar (`bg-background/80` + `backdrop-blur-sm`), `h-14`, content
 * constrained to the same `max-w-[1536px]` as the rest of the app's
 * page chrome. Routes' content wrappers add `pt-14` to clear the
 * fixed bar.
 */
export function Navbar() {
  // Live tournament name, with the build-time config name as a synchronous
  // fallback so the wordmark paints immediately instead of flashing a
  // skeleton — the brand name is fixed for this build either way. Shares the
  // query cache with HomePage's own useTournament() call.
  const tournament = useTournament()
  const tournamentName = tournament.data?.name ?? activeTournament.name

  return (
    <nav className="border-border/50 bg-background/80 fixed top-0 z-50 w-full border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1536px] items-center justify-between gap-3 px-4">
        {/*
         * Plain-text wordmark linking home. The full crest headlines the
         * page hero now (#180); the navbar keeps a quiet text mark so the
         * brand persists once the hero scrolls out of view. The visible
         * text is the link's accessible name, so no aria-label is needed.
         * `min-w-0 truncate` lets it yield to the controls on a narrow bar
         * rather than push them off-screen.
         */}
        <Link
          to="/"
          className="font-display text-foreground min-w-0 truncate text-lg tracking-wide transition-opacity hover:opacity-80 sm:text-xl"
        >
          {tournamentName}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
          <AuthWidget />
        </div>
      </div>
    </nav>
  )
}

/**
 * The right-side auth widget. Three states:
 * - **Loading**: a neutral avatar skeleton — no empty slot, and no flash of
 *   sign-in then account menu (#188).
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
  const { t } = useTranslation()
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

  // Archive mode (#375): auth is offline (no `/v1/me`), so there's no account
  // menu and signing in would be a dead end — the admin tools can't function
  // without the backend. Show the admin entry point as a visibly-disabled
  // button (tooltip explains why) so the surface stays discoverable; the route
  // itself is guarded with an archived notice. The wrapper span carries the
  // tooltip because the disabled button has `pointer-events-none`.
  if (ARCHIVE_MODE) {
    return (
      <span title={t("archive.adminUnavailable")} className="inline-flex">
        <Button
          variant="outline"
          size="sm"
          disabled
          className="cursor-not-allowed gap-1.5"
        >
          <ShieldUser className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("nav.admin")}</span>
        </Button>
      </span>
    )
  }

  // A neutral avatar-sized skeleton while the auth probe resolves — better
  // than an empty slot, and it sidesteps the sign-in-then-account-menu flash
  // that optimistically rendering either state would cause (#188).
  if (isLoading) {
    return <Skeleton className="size-8 rounded-full" />
  }

  if (!isAuthenticated) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={loginUrl(window.location.pathname)}>{t("nav.signIn")}</a>
      </Button>
    )
  }

  // Same identity-fallback chain as the owners list: prefer display_name,
  // then email, then the bare user_id as a last resort if the auth API
  // call somehow returned without identity fields.
  const label = displayName ?? email ?? userId ?? t("nav.profile")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors"
          aria-label={t("nav.accountMenu")}
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
            {t("nav.profile")}
          </a>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <ShieldUser className="size-4" aria-hidden />
              {t("nav.admin")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="size-4" aria-hidden />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
