import { TriangleAlert } from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { Countdown } from "@/components/countdown"
import { HostLinksCard } from "@/components/host-links-card"
import { LadderRaceActiveCard } from "@/components/ladder-race-active-card"
import { PrizePoolCard } from "@/components/prize-pool-card"
import { Button } from "@/components/ui/button"
import { activeTournament } from "@/config/tournaments"
import { useTournament } from "@/hooks/use-tournament"

/**
 * The horizontal context-card strip shown below the hero on every tournament
 * view (#164, #180): the start / grand-finals countdowns (the start slot swaps
 * to the "Ladder Race Active" panel once the race is underway, #147), the
 * prize-pool card (#156), and the host links. Lays out as a responsive grid
 * (1 col → 2 → 4). Self-contained — reads `useTournament()` (shared cache) so
 * it renders identically on `/`, `/teams`, and `/stats`.
 *
 * `mountedAtMs` is captured once via `useState`'s lazy initialiser so
 * `Date.now()` stays out of the render pass (react-hooks/purity); a manual
 * reload re-evaluates whether the race has started.
 */
export function ContextCards() {
  const { t } = useTranslation()
  const tournament = useTournament()
  const [mountedAtMs] = useState(() => Date.now())
  const tournamentStarted = tournament.data?.startDate
    ? new Date(tournament.data.startDate).getTime() <= mountedAtMs
    : false

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/*
       * The countdowns and prize card are data-driven, so a failed
       * `useTournament()` fetch would otherwise collapse all three to null —
       * the strip vanishes and the table jumps up. Show one retry-able error
       * card across their columns instead; the host-links card below is build
       * config, so it stays put and the strip never empties out.
       */}
      {tournament.isError ? (
        <ContextCardsError onRetry={() => void tournament.refetch()} />
      ) : (
        <>
          {tournamentStarted ? (
            <LadderRaceActiveCard />
          ) : (
            <Countdown
              target={tournament.data?.startDate ?? null}
              isLoading={tournament.isPending}
              label={
                <Trans
                  i18nKey="home.ladderRace.begins"
                  components={{
                    accent: <span className="text-brand font-semibold" />,
                  }}
                />
              }
              variant="compact"
            />
          )}
          <Countdown
            target={tournament.data?.endDate ?? null}
            isLoading={tournament.isPending}
            label={
              <Trans
                i18nKey="home.ladderRace.ends"
                components={{
                  // Red "team P2" accent — a go/stop colour contrast against the
                  // brand-blue "Begins". Deliberately the team red, not
                  // --destructive (which would read as an error).
                  accent: <span className="text-team-p2 font-semibold" />,
                }}
              />
            }
            accentClassName="text-team-p2"
            variant="compact"
          />
          <PrizePoolCard
            prizePoolCents={tournament.data?.prizePoolCents}
            currency={activeTournament.prizeCurrency}
            sponsor={activeTournament.prizeSponsor}
            sponsorUrl={activeTournament.prizeSponsorUrl}
            isLoading={tournament.isPending}
          />
        </>
      )}
      <HostLinksCard
        label={
          activeTournament.hostName
            ? t("hostLinks.hostedBy", { host: activeTournament.hostName })
            : undefined
        }
        logo={activeTournament.hostLogo}
        links={activeTournament.hostLinks}
        streamLive={tournament.data?.hostStreamLive ?? false}
      />
    </div>
  )
}

/**
 * Error state for the data-driven context cards (the countdowns + prize pool).
 * A failed `useTournament()` fetch would otherwise collapse all three to null;
 * this keeps the strip populated with a single retry-able card spanning their
 * columns, in the same broadcast-card chrome (accent stripe + corner glow) as
 * its siblings. Mirrors the standings/teams error panels — icon, copy, a
 * `Try again` that re-runs the query — so the page's error states read as one
 * family. `refetch` works because `useTournament` shares the query cache.
 */
function ContextCardsError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="bg-card shadow-card relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg p-4 text-center sm:col-span-2 xl:col-span-3">
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <span
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{
          background: "color-mix(in oklch, var(--brand) 12%, transparent)",
        }}
      />
      <TriangleAlert className="text-muted-foreground size-6" aria-hidden />
      <div className="space-y-0.5">
        <p className="font-medium">{t("home.loadErrorTournament.title")}</p>
        <p className="text-muted-foreground text-sm">
          {t("home.loadErrorTournament.body")}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("common.tryAgain")}
      </Button>
    </section>
  )
}
