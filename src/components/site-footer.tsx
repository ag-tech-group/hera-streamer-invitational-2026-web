import { Trans } from "react-i18next"

/**
 * Footer links have a baseline underline (vs the in-content alias link
 * pattern that's underline-on-hover). The footer copy is set in
 * `text-muted-foreground`, so without a baseline underline the link
 * would render as text indistinguishable from the surrounding prose
 * until the user happens to hover it.
 */
const LINK_CLASS =
  "underline underline-offset-2 transition-colors hover:text-foreground"

/**
 * Site-wide footer with the Microsoft Game Content Usage Rules disclaimer
 * (#35). Required because this site uses assets from Age of Empires II;
 * rendered on every route so the claim accompanies any page that surfaces
 * those assets.
 */
export function SiteFooter() {
  return (
    <footer className="border-border/50 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-[1536px] flex-col gap-1.5 px-8 py-6 text-xs">
        <p>
          <Trans
            i18nKey="footer.criticalbitProject"
            components={{
              link: (
                <a
                  href="https://criticalbit.gg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                />
              ),
            }}
          />
        </p>
        <p>
          <Trans
            i18nKey="footer.microsoftDisclaimer"
            components={{
              link: (
                <a
                  href="https://www.xbox.com/en-us/developers/rules"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                />
              ),
            }}
          />
        </p>
      </div>
    </footer>
  )
}
