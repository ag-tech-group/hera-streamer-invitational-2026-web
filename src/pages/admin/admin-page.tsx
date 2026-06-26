import { Link, useNavigate } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ArchivedNotice } from "@/components/archived-notice"
import { NotFound } from "@/components/not-found"
import { activeTournament } from "@/config/tournaments"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { ARCHIVE_MODE } from "@/lib/archive-mode"
import { useAuth } from "@/lib/auth"
import { loginUrl } from "@/lib/auth-config"
import i18n from "@/lib/i18n"
import { OwnersSection } from "@/pages/admin/sections/owners-section"
import { PlayersSection } from "@/pages/admin/sections/players-section"
import { TeamsSection } from "@/pages/admin/sections/teams-section"
import { TournamentDetailsSection } from "@/pages/admin/sections/tournament-details-section"

/**
 * Admin landing page for the active tournament.
 *
 * Gated on `useAuth().isAdmin` — true only when the signed-in user owns
 * this build's tournament (per `GET /v1/me`'s `owned_tournaments`). For
 * everyone else the page renders `<NotFound />`, matching what a route
 * that doesn't exist would look like — DOM-absent, not CSS-hidden, so a
 * non-admin viewer never finds the admin surface in the markup either.
 *
 * The page is scoped to this build's tournament: it edits *this*
 * tournament's metadata, roster, owners, and teams — not a general-purpose
 * multi-tournament admin (out of scope per #74).
 *
 * Session-expiry handling: when admin access is revoked *while the user
 * is on this page* (a 401-then-refresh-fail flips `isAdmin` from true to
 * false), the page redirects to `/` and surfaces a toast that re-opens
 * the sign-in flow. Without this, the gate would just render
 * `<NotFound />` in place, which is technically correct but reads as the
 * admin route having mysteriously disappeared.
 */
export function AdminPage() {
  const { t } = useTranslation()
  useDocumentTitle(t("admin.title"))
  const { isAdmin, isLoading } = useAuth()
  const navigate = useNavigate()
  const wasAdminRef = useRef(false)

  useEffect(() => {
    if (isLoading) return
    if (wasAdminRef.current && !isAdmin) {
      void navigate({ to: "/" })
      // `i18n.t` (not the hook) because the toast text is the last
      // thing we render before navigating away — the component is
      // about to unmount, so a re-render from the hook would be wasted.
      toast.info(i18n.t("errors.sessionExpired"), {
        action: {
          label: i18n.t("errors.signInAction"),
          onClick: () => {
            // Land back on the admin page after re-auth — that was the
            // original intent before the session dropped. Prefix Vite's
            // base path (trimmed of its trailing slash) so the redirect
            // resolves under the production /<base>/admin (#161); locally
            // BASE_URL is "/" so this collapses to plain "/admin".
            window.location.href = loginUrl(
              `${import.meta.env.BASE_URL.replace(/\/$/, "")}/admin`
            )
          },
        },
      })
    }
    wasAdminRef.current = isAdmin
  }, [isAdmin, isLoading, navigate])

  // Archive mode (#375): the admin tools are offline with the backend scaled
  // down. Guard the route so a bookmarked `/admin` shows the archived notice
  // instead of mounting the admin UI and firing dead API calls. Checked after
  // the hooks above so the rules-of-hooks hold; `ARCHIVE_MODE` is a build
  // constant, so this whole branch is dead code in a normal build.
  if (ARCHIVE_MODE) return <ArchivedNotice />

  if (isLoading) return null
  if (!isAdmin) return <NotFound />
  return <AdminLayout />
}

function AdminLayout() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <header className="border-border flex flex-col gap-2 border-b-2 pb-4">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-sm transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t("admin.backToStandings")}
        </Link>
        <h1 className="font-display text-4xl tracking-wide">
          {t("admin.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{activeTournament.name}</p>
      </header>

      <AdminSection title={t("admin.sections.tournamentDetails")}>
        <TournamentDetailsSection />
      </AdminSection>

      <AdminSection title={t("admin.sections.owners")}>
        <OwnersSection />
      </AdminSection>

      <AdminSection title={t("admin.sections.players")}>
        <PlayersSection />
      </AdminSection>

      <AdminSection title={t("admin.sections.teams")}>
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
