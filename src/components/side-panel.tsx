import { useState } from "react"
import { Trans } from "react-i18next"

import { Countdown } from "@/components/countdown"
import { HostLinksCard } from "@/components/host-links-card"
import { LadderRaceActiveCard } from "@/components/ladder-race-active-card"
import { PrizePoolCard } from "@/components/prize-pool-card"
import { activeTournament } from "@/config/tournaments"
import { useTournament } from "@/hooks/use-tournament"

/**
 * The shared left-hand context column across the standings views (#164): the
 * start / grand-finals countdowns (the start slot swaps to the "Ladder Race
 * Active" panel once the race is underway, #147), the prize-pool card (#156),
 * and the host links. Self-contained — reads `useTournament()` (shared cache)
 * so it renders identically on `/`, `/teams`, and `/stats`.
 *
 * `mountedAtMs` is captured once via `useState`'s lazy initialiser so
 * `Date.now()` stays out of the render pass (react-hooks/purity); a manual
 * reload re-evaluates whether the race has started.
 */
export function SidePanel() {
  const tournament = useTournament()
  const [mountedAtMs] = useState(() => Date.now())
  const tournamentStarted = tournament.data?.startDate
    ? new Date(tournament.data.startDate).getTime() <= mountedAtMs
    : false

  return (
    <div className="flex flex-col gap-6 xl:w-1/4 xl:shrink-0">
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
        label={activeTournament.hostLabel}
        links={activeTournament.hostLinks}
      />
    </div>
  )
}
