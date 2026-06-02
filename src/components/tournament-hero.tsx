import { Trans, useTranslation } from "react-i18next"

import { TournamentLinksBar } from "@/components/tournament-links-bar"
import { activeTournament } from "@/config/tournaments"

/**
 * The shared page hero across the standings views (#164, #180): the full
 * tournament lockup as the centerpiece, with the AoE2:DE-linked tagline
 * beneath. Centered banner over the (left-aligned) standings body below.
 *
 * The lockup art carries the tournament name in its wordmark, so it *is* the
 * page `<h1>` — the name reaches assistive tech and search via the image
 * `alt`, not a duplicate text line. The navbar keeps a plain-text wordmark
 * for when this hero scrolls out of view. The asset is static (build-time
 * config), so there's no metadata fetch and no skeleton — it paints at once.
 */
export function TournamentHero() {
  // `<Trans>` renders against the current language but doesn't subscribe to
  // changes on its own; `useTranslation()` re-renders the hero on a language
  // switch so the subtitle below stays in sync (every other `<Trans>` user in
  // the app pairs it with this hook for the same reason).
  const { t } = useTranslation()

  return (
    <header className="relative flex flex-col items-center gap-4 pb-6 text-center">
      {/*
       * Soft brand-blue glow behind the crest — the same elevated-card chrome
       * recipe as the standings/countdown cards (#114), so the hero frames
       * the logo the way the rest of the page frames its data.
       */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-8 left-1/2 size-72 max-w-full -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background: "color-mix(in oklch, var(--brand) 16%, transparent)",
        }}
      />
      <h1 className="relative m-0">
        {/* width/height match the asset so the row reserves space before the
            image loads (no layout shift); max-width caps the display size. */}
        <img
          src="/logo-full.png"
          alt={activeTournament.name}
          width={1000}
          height={614}
          className="h-auto w-full max-w-[30rem]"
        />
      </h1>
      <p className="text-muted-foreground relative max-w-2xl text-sm">
        <Trans
          t={t}
          i18nKey="home.subtitle"
          components={{
            product: (
              <a
                href="https://store.steampowered.com/app/813780/Age_of_Empires_II_Definitive_Edition/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline underline-offset-2 transition-colors"
              />
            ),
          }}
        />
      </p>
      {/* Tournament resource links (#273/#274/#276/#277), centered as part of
          the hero — quick links to follow the event, distinct from the host's
          watch/support channels on the card strip below. */}
      <TournamentLinksBar
        links={activeTournament.tournamentLinks}
        className="justify-center"
      />
    </header>
  )
}
