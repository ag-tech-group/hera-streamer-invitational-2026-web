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
  isLoading,
  className,
}: {
  prizePoolCents: number | null | undefined
  currency: string | undefined
  isLoading: boolean
  className?: string
}) {
  const { t } = useTranslation()

  if (isLoading) {
    return <PrizePoolCardSkeleton className={className} />
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
        "bg-card shadow-card relative flex flex-col gap-1 overflow-hidden rounded-lg p-4",
        className
      )}
    >
      {/*
       * Broadcast-card chrome (#114): same brand-blue stripe + soft
       * upper-right glow recipe as the countdowns, host-links, and team
       * panels — every sidebar card frames its data the same way.
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
       * Display face at text-3xl, tabular-nums so digits stay visually
       * locked when the admin bumps the value — same treatment the
       * standings rating cell got in #119. Bebas Neue ships at weight 400
       * only, so `font-display` carries the broadcast weight without a
       * synthetic bold.
       */}
      <p className="font-display text-3xl tracking-wide tabular-nums">
        {formatted}
      </p>
    </section>
  )
}

function PrizePoolCardSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-hidden
      className={cn(
        "bg-card shadow-card relative flex flex-col gap-1 overflow-hidden rounded-lg p-4",
        className
      )}
    >
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-1 h-9 w-32" />
    </section>
  )
}
