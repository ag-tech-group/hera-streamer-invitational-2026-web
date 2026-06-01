import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Renders a live countdown to an ISO-8601 timestamp, refreshing once per
 * second.
 *
 * Returns `null` (and stops the interval) when `target` is null or already
 * in the past, so the countdown silently retires itself and leaves no
 * layout gap. Built for the tournament start/end-date heroes (#33 / #17);
 * the `target` and `label` props make it reusable for any future
 * fixed-target countdown.
 */
type Variant = "hero" | "compact"

export function Countdown({
  target,
  label,
  variant = "hero",
  accentClassName = "text-brand",
  isLoading = false,
  className,
}: {
  /** ISO-8601 timestamp to count down to. `null` renders nothing. */
  target: string | null
  /**
   * Optional eyebrow above the digits. Accepts a `ReactNode` so callers can
   * pass a rich label — e.g. a `<Trans>` that brand-highlights one word.
   */
  label?: ReactNode
  /**
   * `hero` (default): page-anchoring big digits, generous padding.
   * `compact`: smaller digits + tighter padding for sidebar / secondary use.
   */
  variant?: Variant
  /**
   * Tailwind text-colour class for the highlighted (leftmost non-zero) digit
   * segment. Defaults to brand blue; the grand-finals countdown passes the
   * team red so its digits match its red "Ends" label (#202).
   */
  accentClassName?: string
  /**
   * Reserve the countdown's layout slot with a skeleton placeholder
   * while the tournament metadata is still in flight. Without this,
   * the parent's `target={data?.startDate ?? null}` pattern collapses
   * the slot to `null` during the brief data-loading window and the
   * page content below shifts by the countdown's full height once the
   * fetch resolves — a CLS-killing layout shift. The flag separates
   * "loading" (reserve space) from "no target" (genuinely no slot
   * needed, the default `null` path).
   */
  isLoading?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const remainingMs = useTickingRemaining(target)
  // Loading state takes precedence over a null target: render the
  // same-size skeleton so the layout slot stays reserved across the
  // load. Once the fetch resolves, either real `target` content or a
  // null return takes over without shifting anything below.
  if (isLoading && target === null) {
    return <CountdownSkeleton variant={variant} className={className} />
  }
  // `target === null` is redundant at runtime (if remainingMs is null, target
  // was null) but narrows the type so `target` can be passed to the formatter
  // below as a non-null string.
  if (target === null || remainingMs === null || remainingMs <= 0) return null

  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  // The leftmost non-zero segment carries the brand accent so the eye lands
  // on the unit that actually matters at this point in the countdown. As
  // higher units tick down to zero the highlight migrates rightward
  // (days → hrs → min → sec) — a built-in "urgency progression" without any
  // animation. Seconds is the floor since the component already returns
  // null when the whole remaining time is zero.
  const segmentValues = [days, hours, minutes, seconds]
  const highlightIndex = segmentValues.findIndex((v) => v > 0)

  const isHero = variant === "hero"
  return (
    <section
      className={cn(
        "bg-card shadow-card relative flex flex-col items-center gap-3 overflow-hidden rounded-lg",
        isHero ? "p-6" : "p-4",
        className
      )}
    >
      {/*
       * Broadcast-card chrome (#114): brand-blue accent stripe + soft
       * upper-right corner glow, matching the team panels and the
       * standings table. Same JSX recipe so every card on the page
       * frames data the same way.
       */}
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <span
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{
          background: "color-mix(in oklch, var(--brand) 12%, transparent)",
        }}
      />
      {label ? (
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {label}
        </p>
      ) : null}
      <div
        className={cn(
          "flex items-baseline tabular-nums",
          isHero ? "gap-3 sm:gap-5" : "gap-2 sm:gap-3"
        )}
      >
        <Segment
          value={days}
          unit={t("countdown.days")}
          variant={variant}
          highlighted={highlightIndex === 0}
          accentClassName={accentClassName}
        />
        <Separator variant={variant} />
        <Segment
          value={hours}
          unit={t("countdown.hours")}
          variant={variant}
          highlighted={highlightIndex === 1}
          accentClassName={accentClassName}
        />
        <Separator variant={variant} />
        <Segment
          value={minutes}
          unit={t("countdown.minutes")}
          variant={variant}
          highlighted={highlightIndex === 2}
          accentClassName={accentClassName}
        />
        <Separator variant={variant} />
        <Segment
          value={seconds}
          unit={t("countdown.seconds")}
          variant={variant}
          highlighted={highlightIndex === 3}
          accentClassName={accentClassName}
        />
      </div>
      <p
        className={cn(
          "font-medium",
          isHero ? "text-sm sm:text-base" : "text-center text-xs"
        )}
      >
        {formatTargetDateTime(target)}
      </p>
    </section>
  )
}

function Segment({
  value,
  unit,
  variant,
  highlighted,
  accentClassName,
}: {
  value: number
  unit: string
  variant: Variant
  highlighted: boolean
  accentClassName: string
}) {
  const isHero = variant === "hero"
  return (
    <div className="flex flex-col items-center gap-1">
      {/*
       * Bebas Neue ships only weight 400; we drop `font-bold` here for the
       * same reason as the page <h1>. The face is heavy enough at 400.
       */}
      <span
        className={cn(
          "font-display leading-none transition-colors",
          isHero ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl",
          highlighted && accentClassName
        )}
      >
        {value.toString().padStart(2, "0")}
      </span>
      <span
        className={cn(
          "text-muted-foreground font-medium tracking-wider uppercase",
          isHero ? "text-[10px]" : "text-[9px]"
        )}
      >
        {unit}
      </span>
    </div>
  )
}

function Separator({ variant }: { variant: Variant }) {
  const isHero = variant === "hero"
  return (
    <span
      aria-hidden
      className={cn(
        "text-muted-foreground/40 leading-none",
        isHero ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
      )}
    >
      :
    </span>
  )
}

/**
 * Loading-state counterpart of `Countdown`. Mirrors the live component's
 * chrome (card + accent stripe + corner glow) and segment layout so the
 * skeleton-to-data transition is a content swap rather than a layout shift.
 *
 * Dimensions are intentionally hard-coded against the live segment sizes
 * (`text-3xl sm:text-4xl` digits for compact, `text-5xl sm:text-6xl` for
 * hero) so a copy-paste tweak to the live component doesn't silently break
 * the skeleton's height match — if you change segment sizing there, mirror
 * the placeholder size here.
 */
function CountdownSkeleton({
  variant,
  className,
}: {
  variant: Variant
  className?: string
}) {
  const isHero = variant === "hero"
  return (
    <section
      aria-busy
      className={cn(
        "bg-card shadow-card relative flex flex-col items-center gap-3 overflow-hidden rounded-lg",
        isHero ? "p-6" : "p-4",
        className
      )}
    >
      {/* Mirror the live brand-blue accent stripe + corner glow so the
          skeleton's chrome doesn't pop into existence when data arrives. */}
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <span
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{
          background: "color-mix(in oklch, var(--brand) 12%, transparent)",
        }}
      />
      {/* Eyebrow label placeholder. */}
      <Skeleton className="h-3 w-32" />
      {/* Digits row placeholder. Width matches roughly four 2-digit segments
          + three colon separators at the variant's font size. */}
      <Skeleton
        className={cn("rounded-md", isHero ? "h-14 w-60" : "h-10 w-44")}
      />
      {/* Date footer placeholder. */}
      <Skeleton className={cn("h-3", isHero ? "w-56" : "w-40")} />
    </section>
  )
}

/**
 * Milliseconds remaining until `target`, refreshing once per second.
 *
 * Returns `null` when `target` is null; the interval is only set up for a
 * non-null target so the hook is cheap while the countdown is hidden.
 */
function useTickingRemaining(target: string | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  if (!target) return null
  return new Date(target).getTime() - now
}

/**
 * Formats an ISO-8601 timestamp as a human-readable date and time in the
 * viewer's locale and timezone (e.g. "June 1, 2026, 5:00 PM EDT") so the
 * countdown reads as a concrete moment, not just a duration.
 */
function formatTargetDateTime(iso: string): string {
  // `undefined` locale → defers to the browser's resolved locale, so the
  // formatted date and timezone abbreviation follow whichever language the
  // user has selected via the navbar (i18next syncs `document.documentElement.lang`).
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso))
}
