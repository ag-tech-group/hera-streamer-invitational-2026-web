import { Check, Languages } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAnalytics } from "@/lib/analytics"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"

/**
 * Language picker for the navbar. Mirrors ThemeToggle's footprint — a
 * compact ghost button — but uses a dropdown rather than a cycle, so the
 * menu can grow past two options without re-thinking the affordance.
 *
 * The current language is persisted to localStorage by i18next's
 * detector (configured in `@/lib/i18n`); reading it from `i18n.language`
 * keeps the visual state in lockstep with whatever the rest of the app
 * resolves translations against.
 */
export function LanguageToggle() {
  const { i18n, t } = useTranslation()
  const analytics = useAnalytics()
  const current = (i18n.resolvedLanguage ?? i18n.language) as SupportedLanguage

  function pick(next: SupportedLanguage) {
    if (next === current) return
    analytics.track("language.changed", { from: current, to: next })
    void i18n.changeLanguage(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
         * aria-label starts with the visible code (e.g. "EN") so it
         * matches the on-screen label — Lighthouse / WCAG flag a
         * mismatch when an aria-label doesn't contain the visible text.
         * The descriptor ("— Language") follows so a screen reader user
         * still hears what the button controls.
         */}
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${current.toUpperCase()} — ${t("language.label")}`}
          title={t("language.label")}
        >
          <Languages className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{current.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {SUPPORTED_LANGUAGES.map((lng) => (
          <DropdownMenuItem
            key={lng}
            onClick={() => pick(lng)}
            className="justify-between"
          >
            {t(`language.${lng}`)}
            {lng === current ? <Check className="size-4" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
