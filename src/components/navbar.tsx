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
import { useTournament } from "@/hooks/use-tournament"
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
  const { t } = useTranslation()
  // Shares the cache entry with HomePage's own useTournament() call — both
  // hit the same query key, so the navbar piggybacks on whichever fetch
  // resolves first and re-renders when the name arrives.
  const tournament = useTournament()
  const tournamentName = tournament.data?.name ?? null

  return (
    <nav className="border-border/50 bg-background/80 fixed top-0 z-50 w-full border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1536px] items-center justify-between gap-3 px-4">
        {/*
         * aria-label uses the live tournament name once it's loaded so it
         * matches the visible text rather than diverging into a stale
         * fallback (Lighthouse flags a mismatch between accessible name
         * and visible label as a WCAG violation). Falls back to the
         * generic "Live Standings" while the metadata fetch is in
         * flight, since the logo's alt="" makes the image decorative and
         * the link otherwise has no accessible name during loading.
         */}
        <Link
          to="/"
          className="flex shrink-0 items-center transition-opacity hover:opacity-80"
          aria-label={tournamentName ?? t("nav.brandAriaLabel")}
        >
          <img src="/logo.png" alt="" className="size-8 shrink-0" />
        </Link>
        <div className="flex items-center gap-2">
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
