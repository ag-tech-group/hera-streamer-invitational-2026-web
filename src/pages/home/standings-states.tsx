import { Shield, TriangleAlert, Users } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useNormalizedError } from "@/lib/api-errors"

/** Shared chrome for the empty/error side panels — same elevated card surface as the populated tables, so all three states sit at the same depth on the page. */
const PANEL_CLASS =
  "bg-card shadow-card flex flex-col items-center gap-3 rounded-lg px-6 py-16 text-center"

/**
 * Shown when the standings request succeeds but the leaderboard has no
 * players yet. An expected pre-tournament state — the icon + copy carry
 * the "no data" signal, while the card surface keeps it visually
 * consistent with the populated table.
 */
export function StandingsEmpty() {
  const { t } = useTranslation()
  return (
    <div className={PANEL_CLASS}>
      <Users className="text-muted-foreground size-8" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t("home.noStandings.title")}</p>
        <p className="text-muted-foreground text-sm">
          {t("home.noStandings.body")}
        </p>
      </div>
    </div>
  )
}

/**
 * Shown when the standings request fails. Offers a manual retry; live SSE
 * nudges also re-trigger the request automatically as new data lands. The
 * request ID (from the API's error envelope or `X-Request-ID` header) is
 * surfaced here so users can quote it to support — see #70.
 */
export function StandingsError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const normalized = useNormalizedError(error)
  return (
    <div className={PANEL_CLASS}>
      <TriangleAlert className="text-destructive size-8" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t("home.loadErrorStandings.title")}</p>
        <p className="text-muted-foreground text-sm">
          {t("home.loadErrorStandings.body")}
        </p>
        {normalized?.requestId ? (
          <p className="text-muted-foreground/70 font-mono text-xs">
            {t("common.reference", { id: normalized.requestId })}
          </p>
        ) : null}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("common.tryAgain")}
      </Button>
    </div>
  )
}

/**
 * Shown when the team standings request succeeds but no teams are set up
 * for this tournament. Teams are optional, so an empty list is expected;
 * the card surface matches the populated team table at the same depth.
 */
export function TeamsEmpty() {
  const { t } = useTranslation()
  return (
    <div className={PANEL_CLASS}>
      <Shield className="text-muted-foreground size-8" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t("home.noTeams.title")}</p>
        <p className="text-muted-foreground text-sm">
          {t("home.noTeams.body")}
        </p>
      </div>
    </div>
  )
}

/**
 * Shown when the team standings request fails. Offers a manual retry; live
 * SSE nudges also re-trigger the request automatically as new data lands.
 * Matches `StandingsError`: the request ID is surfaced when available.
 */
export function TeamsError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const normalized = useNormalizedError(error)
  return (
    <div className={PANEL_CLASS}>
      <TriangleAlert className="text-destructive size-8" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t("home.loadErrorTeams.title")}</p>
        <p className="text-muted-foreground text-sm">
          {t("home.loadErrorTeams.body")}
        </p>
        {normalized?.requestId ? (
          <p className="text-muted-foreground/70 font-mono text-xs">
            {t("common.reference", { id: normalized.requestId })}
          </p>
        ) : null}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("common.tryAgain")}
      </Button>
    </div>
  )
}
