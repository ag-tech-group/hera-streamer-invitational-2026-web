import { Trans, useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { useTournament } from "@/hooks/use-tournament"

/**
 * The shared page hero across the standings views (#164): the live tournament
 * name as the headline with the AoE2:DE-linked description beneath. Self-
 * contained — reads `useTournament()` (shared query cache) so `/`, `/teams`,
 * and `/stats` all show the same hero without threading props.
 *
 * Drops `font-bold` because Bebas Neue ships only weight 400 — a synthetic
 * 700 emboldens the glyphs badly. Skeleton while the name loads so the row
 * doesn't jump; the generic "Live Standings" shows only if the metadata
 * never lands.
 */
export function TournamentHero() {
  const { t } = useTranslation()
  const tournament = useTournament()
  return (
    <header className="hero-divider flex flex-col gap-1 pb-4">
      {tournament.isPending ? (
        <Skeleton className="h-10 w-72 max-w-full" />
      ) : (
        <h1 className="font-display text-4xl tracking-wide">
          {tournament.data?.name ?? t("home.title")}
        </h1>
      )}
      <p className="text-muted-foreground text-sm">
        <Trans
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
    </header>
  )
}
