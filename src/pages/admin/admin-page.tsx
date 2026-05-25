import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"

import { NotFound } from "@/components/not-found"
import { ThemeToggle } from "@/components/theme-toggle"
import { activeTournament } from "@/config/tournaments"
import { useFeatureFlag } from "@/lib/feature-flags"
import { OwnersSection } from "@/pages/admin/sections/owners-section"
import { PlayersSection } from "@/pages/admin/sections/players-section"
import { TeamsSection } from "@/pages/admin/sections/teams-section"
import { TournamentDetailsSection } from "@/pages/admin/sections/tournament-details-section"

/**
 * Admin landing page for the active tournament.
 *
 * Gated by the `admin_tab` feature flag — see #74 and the follow-up #80.
 * The flag is the temporary stand-in for real auth: until the sign-in flow
 * lands (#80), the admin surface is hidden DOM-absent (not just
 * CSS-hidden) so an unauthenticated viewer never sees it in the markup or
 * discovers the route by accident. When the flag is off, the page renders
 * a 404, matching what a route that doesn't exist would look like.
 *
 * The page is scoped to this build's tournament: it edits *this*
 * tournament's metadata, roster, owners, and teams — not a general-purpose
 * multi-tournament admin (out of scope per #74).
 */
export function AdminPage() {
  const { enabled, loading } = useFeatureFlag("admin_tab")
  if (loading) return null
  if (!enabled) return <NotFound />
  return <AdminLayout />
}

function AdminLayout() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b-2 pb-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Back to standings
          </Link>
          <div className="flex flex-col">
            <h1 className="font-display text-4xl tracking-wide">Admin</h1>
            <p className="text-muted-foreground text-sm">
              {activeTournament.name}
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <AdminSection title="Tournament details">
        <TournamentDetailsSection />
      </AdminSection>

      <AdminSection title="Owners">
        <OwnersSection />
      </AdminSection>

      <AdminSection title="Players">
        <PlayersSection />
      </AdminSection>

      <AdminSection title="Teams">
        <TeamsSection />
      </AdminSection>
    </div>
  )
}

/** Reusable card-style section wrapper for the admin page's content blocks. */
function AdminSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-card shadow-card flex flex-col gap-4 rounded-lg p-6">
      <h2 className="font-display text-2xl tracking-wide">{title}</h2>
      {children}
    </section>
  )
}
