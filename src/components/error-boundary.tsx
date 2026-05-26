import * as Sentry from "@sentry/react"
import { Link } from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { logger } from "@/lib/logger"

export function ErrorBoundary({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation()
  logger.error("Uncaught error in route component", {
    message: error.message,
    stack: error.stack,
  })
  // Sentry.captureException is a no-op when the SDK isn't initialized (no
  // VITE_SENTRY_DSN), so safe to call unconditionally.
  Sentry.captureException(error)

  return (
    // `flex-1` fills the available space inside the app shell's `<main>`
    // rather than taking the whole viewport — keeps the navbar and
    // footer visible while the error state is up.
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
        {t("errorBoundary.eyebrow")}
      </p>
      <h1 className="text-primary text-7xl font-bold tracking-tight">
        {t("errorBoundary.heading")}
      </h1>
      <p className="text-muted-foreground text-base">
        {t("errorBoundary.body")}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>{t("errorBoundary.retry")}</Button>
        <Button variant="outline" asChild>
          <Link to="/">{t("errorBoundary.home")}</Link>
        </Button>
      </div>
    </div>
  )
}
