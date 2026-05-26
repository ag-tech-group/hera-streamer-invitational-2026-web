import { Trans } from "react-i18next"

const LINK_CLASS =
  "hover:text-foreground underline-offset-2 transition-colors hover:underline"

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
