import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

export function NotFound() {
  const { t } = useTranslation()
  return (
    // `flex-1` fills the available space inside the app shell's `<main>`
    // (between the persistent navbar and the footer) rather than the
    // whole viewport — keeps the user's navigation chrome visible.
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
        {t("notFound.eyebrow")}
      </p>
      <h1 className="text-primary text-7xl font-bold tracking-tight">
        {t("notFound.code")}
      </h1>
      <p className="text-muted-foreground text-base">{t("notFound.body")}</p>
      <Button asChild>
        <Link to="/">{t("notFound.homeAction")}</Link>
      </Button>
    </div>
  )
}
