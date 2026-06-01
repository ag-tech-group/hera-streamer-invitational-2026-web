import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { Countdown } from "@/components/countdown"
import { HostLinksCard } from "@/components/host-links-card"
import { LadderRaceActiveCard } from "@/components/ladder-race-active-card"
import { PrizePoolCard } from "@/components/prize-pool-card"
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
        target={tournament.data?.grandFinalsDate ?? null}
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
