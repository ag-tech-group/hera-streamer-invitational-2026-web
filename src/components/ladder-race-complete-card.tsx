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
 * Deliberately content-free about the playoffs: the post-race takeover (the
 * bracket, the playoffs schedule, qualification annotations) is host-curated
 * and ships separately from the tournament presentation bag (#363/#364). This
 * card states only what the dates already imply — the race is over and the
 * standings below are final.
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
    </section>
  )
}
