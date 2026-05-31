import { useTranslation } from "react-i18next"

/**
 * Footer links have a baseline underline (vs the in-content alias link
 * pattern that's underline-on-hover). The footer copy is set in
 * `text-muted-foreground`, so without a baseline underline the link
 * would render as text indistinguishable from the surrounding prose
 * until the user happened to hover it.
 */
const LINK_CLASS =
  "underline underline-offset-2 transition-colors hover:text-foreground"

/**
 * Site-wide footer with the Microsoft Game Content Usage Rules disclaimer
 * (#35). Required because this site uses assets from Age of Empires II;
 * rendered on every route so the claim accompanies any page that surfaces
 * those assets.
 *
 * Also carries the criticalbit Privacy and Terms links (#216). This site is
 * a `*.criticalbit.gg` property operated by AG Technology Group LLC and its
 * data processing (PostHog analytics, Sentry error tracking, the shared auth
 * cookie) is governed by the platform-wide policy at criticalbit.gg — so we
 * link that canonical policy rather than author a separate one that could
 * drift. The links are absolute cross-origin `<a>`s, not router `<Link>`s:
 * `/privacy` and `/terms` are routes on the criticalbit.gg origin, not this
 * SPA, so a same-origin `<Link>` would 404.
 *
 * A closing copyright line names AG Technology Group LLC as the operator.
 * The year is computed at render (`new Date().getFullYear()`) rather than
 * hardcoded, so it never silently goes stale at the next year boundary.
 *
 * Each prose line uses the same prefix/link/suffix i18n pattern the home-page
 * subtitle does: a direct `<a>` wraps the link text and the surrounding
 * prose comes from two sibling translation keys. The earlier `<Trans>`
 * version with a `<link>` placeholder rendered the anchor as a self-closing
 * void element — `<link>` is a real void HTML tag (e.g.
 * `<link rel="stylesheet">`), and react-i18next parsed the placeholder as
 * the HTML element rather than the named component, so the "link" text
 * ended up as a sibling text node next to an empty `<a />`. Bypassing
 * `<Trans>` here side-steps the conflict.
 */
export function SiteFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  return (
    <footer className="border-border/50 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-[1536px] flex-col gap-1.5 px-8 py-6 text-xs">
        <div className="flex items-center justify-between gap-4">
          <p>
            {t("footer.criticalbitProjectPrefix")}
            <a
              href="https://criticalbit.gg"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {t("footer.criticalbitProjectLink")}
            </a>
            {t("footer.criticalbitProjectSuffix")}
          </p>
          <nav
            aria-label={t("footer.legalNavLabel")}
            className="flex shrink-0 items-center gap-2"
          >
            <a
              href="https://criticalbit.gg/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {t("footer.privacyLink")}
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://criticalbit.gg/terms"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {t("footer.termsLink")}
            </a>
          </nav>
        </div>
        <p>
          {t("footer.microsoftDisclaimerPrefix")}
          <a
            href="https://www.xbox.com/en-us/developers/rules"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {t("footer.microsoftDisclaimerLink")}
          </a>
          {t("footer.microsoftDisclaimerSuffix")}
        </p>
        <p>{t("footer.copyright", { year })}</p>
      </div>
    </footer>
  )
}
