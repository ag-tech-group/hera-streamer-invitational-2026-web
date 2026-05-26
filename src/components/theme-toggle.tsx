import { Moon, Monitor, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { useAnalytics } from "@/lib/analytics"

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const analytics = useAnalytics()

  function cycle() {
    const next =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light"
    analytics.track("theme.changed", { from: theme, to: next })
    setTheme(next)
  }

  return (
    <Button variant="ghost" size="sm" onClick={cycle}>
      {theme === "light" && (
        <>
          <Sun className="h-4 w-4" /> {t("theme.light")}
        </>
      )}
      {theme === "dark" && (
        <>
          <Moon className="h-4 w-4" /> {t("theme.dark")}
        </>
      )}
      {theme === "system" && (
        <>
          <Monitor className="h-4 w-4" /> {t("theme.auto")}
        </>
      )}
    </Button>
  )
}
