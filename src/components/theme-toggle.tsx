import { Moon, Monitor, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { useAnalytics } from "@/lib/analytics"

export function ThemeToggle() {
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
          <Sun className="h-4 w-4" /> Light
        </>
      )}
      {theme === "dark" && (
        <>
          <Moon className="h-4 w-4" /> Dark
        </>
      )}
      {theme === "system" && (
        <>
          <Monitor className="h-4 w-4" /> Auto
        </>
      )}
    </Button>
  )
}
