import { ArrowUpRight, CircleCheck, Youtube } from "lucide-react"
import { Trans, useTranslation } from "react-i18next"

import { useAnalytics } from "@/lib/analytics"
import { cn } from "@/lib/utils"

/**
 * Grand-finals broadcast the completion card points at — a single hand-placed
 * promo link (like the hero's game link), not a config-driven host link, so it
 * lives here in the frontend with no API field behind it (#373).
 */
const GRAND_FINALS_URL = "https://www.youtube.com/watch?v=rVEBE7RVUTc"

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
 * final), the card closes with a thank-you to the players and a watch link to
 * the grand-finals broadcast — the latter, a brand-filled button, carrying the
 * emphasis as the card's one call to action. It still stops short of the full
 * post-race takeover (the bracket, the playoffs schedule, qualification
 * annotations), which is host-curated and ships separately from the tournament
 * presentation bag (#363/#364); the grand-finals link is a single hand-written
 * promo, not that.
 *
 * The card spans two grid columns once the strip widens (`sm:col-span-2`), so
 * at `sm`+ the content splits two-up — copy on the inline-start half, the CTA
 * centered in the inline-end half — to fill what would otherwise be a yawning
 * empty right side. Below `sm` the card is a single narrow slot, so it stacks
 * back to one column with the button centered beneath the copy (#373).
 */
export function LadderRaceCompleteCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const analytics = useAnalytics()
  return (
    <section
      className={cn(
        "bg-card shadow-card relative overflow-hidden rounded-lg p-4",
        className
      )}
    >
      {/*
       * Broadcast-card chrome (#114): brand-blue accent stripe + soft
       * upper-right corner glow, matching the countdowns, host-links card,
       * team panels, and standings table. Same JSX recipe so every card on
       * the page frames its content the same way. Absolutely positioned, so
       * the two-up content layout below lays out independently of it.
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
       * Two-up on a wide card, stacked on a narrow one. The columns stretch to
       * equal height (default `items-stretch`), so the CTA column becomes a
       * full-height box the button can sit dead-center of — see its wrapper
       * below — rather than collapsing to the button's own height.
       */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        {/* Inline-start half: the finished-state copy. */}
        <div className="flex flex-col gap-3 sm:flex-1">
          {/*
           * Eyebrow title with a static check mark — the finished-state
           * counterpart of the active card's pulsing "live" dot. The race is
           * over, so nothing pulses.
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
          {/* A warm sign-off to the players, muted like the body. */}
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("home.ladderRace.ended.congrats")}
          </p>
        </div>
        {/*
         * Inline-end half: the grand-finals watch link — the card's one call
         * to action (#373). `items-center justify-center` parks it dead-center
         * of the full-height column so it fills the freed space; a solid brand
         * fill with a soft brand glow makes it the panel's visual anchor,
         * reusing the same accent vocabulary as the chrome above, and the
         * trailing arrow nudges outward on hover to flag that it opens the
         * broadcast off-site. The same centering carries over to the stacked
         * layout, where it centers the button beneath the copy.
         */}
        <div className="flex items-center justify-center sm:flex-1">
          <a
            href={GRAND_FINALS_URL}
            target="_blank"
            rel="noopener noreferrer"
            // #373: grand-finals broadcast CTA on the race-complete card.
            onClick={() =>
              analytics.track("grandfinals.link.click", {
                source: "race_complete_card",
              })
            }
            className={cn(
              "group/cta bg-brand text-brand-foreground inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold",
              "transition duration-200 hover:brightness-110 motion-reduce:transition-none",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
            )}
            style={{
              boxShadow:
                "0 0 20px color-mix(in oklch, var(--brand) 40%, transparent)",
            }}
          >
            <Youtube className="size-4 shrink-0" aria-hidden />
            <span>{t("home.ladderRace.ended.grandFinals")}</span>
            <ArrowUpRight
              aria-hidden
              className="size-4 shrink-0 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 motion-reduce:transition-none"
            />
          </a>
        </div>
      </div>
    </section>
  )
}
