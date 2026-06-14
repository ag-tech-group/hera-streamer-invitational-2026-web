import { CircleCheck } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * A static "Final standings" pill shown in the tab row in place of the live
 * "Updated Ns ago" badge once the ladder race has ended (#363).
 *
 * The standings freeze server-side at race end
 * (aoe2-live-standings-api#275), so the ticking freshness badge would keep
 * counting up forever and read as staleness; this states plainly that the
 * order is final instead. No pulsing dot — the data isn't moving any more.
 *
 * Sized like {@link LastUpdatedBadge} (same pill chrome) so the swap-in at the
 * moment the race ends doesn't shift the tab row.
 */
export function FinalStandingsBadge() {
  const { t } = useTranslation()
  return (
    <span className="text-foreground inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium">
      <CircleCheck className="text-brand size-3.5 shrink-0" aria-hidden />
      {t("home.standingsFinal")}
    </span>
  )
}
