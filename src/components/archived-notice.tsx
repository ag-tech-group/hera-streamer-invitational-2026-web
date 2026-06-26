import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

/**
 * Shown in place of the admin surface when the app is built in archive mode
 * (#375). A bookmarked `/admin` URL would otherwise mount the admin UI and fire
 * a burst of dead API calls against a backend that's been scaled down; this
 * renders a calm "the event is archived" notice instead, mirroring the
 * `NotFound` layout so it sits naturally inside the app shell.
 */
export function ArchivedNotice() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
        {t("archive.eyebrow")}
      </p>
      <h1 className="text-primary text-4xl font-bold tracking-tight">
        {t("archive.adminTitle")}
      </h1>
      <p className="text-muted-foreground max-w-md text-base">
        {t("archive.adminBody")}
      </p>
      <Button asChild>
        <Link to="/">{t("admin.backToStandings")}</Link>
      </Button>
    </div>
  )
}
