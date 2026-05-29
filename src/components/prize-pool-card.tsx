import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Sidebar card showing the active tournament's prize pool, formatted via
 * `Intl.NumberFormat` in the per-build display currency. The API stores
 * the amount as integer minor units (cents) so money handling stays out
 * of floating-point; the divide-by-100 happens once at render time.
 *
 * Returns `null` when the prize pool isn't set (the natural pre-launch
 * state, plus any tournament that runs without a published pool) so the
 * layout collapses cleanly. Shows a same-size skeleton while the
 * tournament fetch is in flight — same pattern as the countdown and the
 * last-updated badge, so the card doesn't pop into existence on data
 * arrival.
 */
export function PrizePoolCard({
  prizePoolCents,
  currency,
  sponsor,
  isLoading,
  className,
}: {
  prizePoolCents: number | null | undefined
  currency: string | undefined
  /** Optional sponsor credited as muted text under the amount (#156). */
  sponsor?: string
  isLoading: boolean
  className?: string
}) {
  const { t } = useTranslation()

  if (isLoading) {
    return <PrizePoolCardSkeleton sponsor={sponsor} className={className} />
  }
  // No currency configured for this build, or the DB has no value yet —
  // either way, nothing to render.
  if (prizePoolCents == null || !currency) return null

  // Round amounts (e.g. $5,000.00) drop their decimals for a cleaner
  // broadcast display; non-round values keep two decimal places so a
  // running total from donations still reads honestly.
  const isRound = prizePoolCents % 100 === 0
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(prizePoolCents / 100)

  return (
    <section
      className={cn(
        "bg-card shadow-card relative flex flex-col items-center gap-2 overflow-hidden rounded-lg p-4",
        className
      )}
    >
      {/*
       * Broadcast-card chrome (#114): same brand-blue stripe + soft
       * upper-right glow recipe as the countdowns, host-links, and team
       * panels — every sidebar card frames its data the same way.
       * `items-center` centres the eyebrow / amount / sponsor stack so the
       * card reads as a single unit alongside the centred countdowns.
       */}
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{
          background: "color-mix(in oklch, var(--brand) 12%, transparent)",
        }}
      />
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {t("home.prizePool.label")}
      </p>
      {/*
       * Display face at text-4xl, tabular-nums so digits stay visually
       * locked when the admin bumps the value. Sized up from the
       * standings rating cell's text-lg (#119) because the prize pool is
       * this card's headline number, not a stat in a row. Bebas Neue
       * ships at weight 400 only, so `font-display` carries the broadcast
       * weight without a synthetic bold.
       */}
      <p className="font-display text-4xl tracking-wide tabular-nums">
        {formatted}
      </p>
      {sponsor && (
        <p className="text-muted-foreground text-xs">
          {t("home.prizePool.sponsoredBy", { sponsor })}
        </p>
      )}
    </section>
  )
}

function PrizePoolCardSkeleton({
  sponsor,
  className,
}: {
  sponsor?: string
  className?: string
}) {
  return (
    <section
      aria-hidden
      className={cn(
        "bg-card shadow-card relative flex flex-col items-center gap-2 overflow-hidden rounded-lg p-4",
        className
      )}
    >
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-10 w-32" />
      {sponsor && <Skeleton className="h-3 w-24" />}
    </section>
  )
}
