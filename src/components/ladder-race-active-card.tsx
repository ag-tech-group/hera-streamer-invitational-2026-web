import { Trans, useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

/**
 * Info panel shown in the left column once the Ladder Race is underway —
 * it replaces the "Ladder Race Begins" countdown the moment the start date
 * passes (see #147). The "Ladder Race Ends" countdown keeps running beside
 * it. Wears the same broadcast-card chrome as the countdowns and host-links
 * card so the column reads as one family.
 */
export function LadderRaceActiveCard({ className }: { className?: string }) {
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
       * Eyebrow title carrying a pulsing brand dot — the same ping-ring
       * recipe as the standings table's "Live" badge, reused here as a
       * live-status cue that the race is currently running.
       */}
      <p className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
        <span className="relative flex size-1.5 shrink-0" aria-hidden>
          <span className="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-75" />
          <span className="bg-brand relative inline-flex size-1.5 rounded-full" />
        </span>
        {/* Wrapped so the dot + label are two flex items — the highlighted
            word stays inline within the label, not gapped by the flex. */}
        <span>
          <Trans
            i18nKey="home.ladderRace.active.title"
            components={{
              accent: <span className="text-brand font-semibold" />,
            }}
          />
        </span>
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("home.ladderRace.active.body")}
      </p>
    </section>
  )
}
