import { CircleCheck } from "lucide-react"
import { Trans, useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

/**
 * Info panel shown in the left column once the Ladder Race has ended — it
 * replaces both the "Ladder Race Active" card and the now-elapsed "Ladder Race
 * Ends" countdown the moment `endDate` passes (#363). Without it the countdown
 * would simply vanish (it returns null once its target is past) and the active
 * card would keep claiming the race is underway, so the strip reads as a
 * finished event instead. Wears the same broadcast-card chrome as its siblings
 * so the column stays one family.
 *
 * Beyond what the dates imply (the race is over, the standings below are
 * final), the card closes with a thank-you to the players and a tune-in pointer
 * to the host's main event — the latter carrying the emphasis as the card's one
 * call to action. It still stops short of the full post-race takeover (the
 * bracket, the playoffs schedule, qualification annotations), which is
 * host-curated and ships separately from the tournament presentation bag
 * (#363/#364); the main-event line is a single hand-written promo, not that.
 */
export function LadderRaceCompleteCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <section
      className={cn(
        "bg-card shadow-card relative flex flex-col gap-3 overflow-hidden rounded-lg p-4",
        className
      )}
    >
      {/*
       * Broadcast-card chrome (#114): brand-blue accent stripe + soft
       * upper-right corner glow, matching the countdowns, host-links card,
       * team panels, and standings table. Same JSX recipe so every card on
       * the page frames its content the same way.
       */}
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <span
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{
          background: "color-mix(in oklch, var(--brand) 12%, transparent)",
        }}
      />
      {/*
       * Eyebrow title with a static check mark — the finished-state counterpart
       * of the active card's pulsing "live" dot. The race is over, so nothing
       * pulses.
       */}
      <p className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
        <CircleCheck className="text-brand size-3.5 shrink-0" aria-hidden />
        <span>
          <Trans
            i18nKey="home.ladderRace.ended.title"
            components={{
              accent: <span className="text-brand font-semibold" />,
            }}
          />
        </span>
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("home.ladderRace.ended.body")}
      </p>
      {/* A warm sign-off to the players (muted, like the body), then the
          main-event tune-in as the card's call to action — the emphasis
          (foreground + medium weight) sits on the tune-in line. */}
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("home.ladderRace.ended.congrats")}
      </p>
      <p className="text-foreground text-sm font-medium">
        {t("home.ladderRace.ended.mainEvent")}
      </p>
    </section>
  )
}
