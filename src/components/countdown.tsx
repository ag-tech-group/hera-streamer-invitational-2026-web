import { useEffect, useState } from "react"

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
export function Countdown({
  target,
  label,
  className,
}: {
  /** ISO-8601 timestamp to count down to. `null` renders nothing. */
  target: string | null
  /** Optional eyebrow above the digits, e.g. `"Tournament starts in"`. */
  label?: string
  className?: string
}) {
  const remainingMs = useTickingRemaining(target)
  // `target === null` is redundant at runtime (if remainingMs is null, target
  // was null) but narrows the type so `target` can be passed to the formatter
  // below as a non-null string.
  if (target === null || remainingMs === null || remainingMs <= 0) return null

  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return (
    <section
      className={cn(
        "bg-card flex flex-col items-center gap-3 rounded-lg border p-6",
        className
      )}
    >
      {label ? (
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {label}
        </p>
      ) : null}
      <p className="text-sm font-medium sm:text-base">
        {formatTargetDateTime(target)}
      </p>
      <div className="flex items-baseline gap-3 tabular-nums sm:gap-5">
        <Segment value={days} unit="days" />
        <Separator />
        <Segment value={hours} unit="hrs" />
        <Separator />
        <Segment value={minutes} unit="min" />
        <Separator />
        <Segment value={seconds} unit="sec" />
      </div>
    </section>
  )
}

function Segment({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/*
       * Bebas Neue ships only weight 400; we drop `font-bold` here for the
       * same reason as the page <h1>. The face is heavy enough at 400.
       */}
      <span className="font-display text-5xl leading-none sm:text-6xl">
        {value.toString().padStart(2, "0")}
      </span>
      <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {unit}
      </span>
    </div>
  )
}

function Separator() {
  return (
    <span
      aria-hidden
      className="text-muted-foreground/40 text-3xl leading-none sm:text-4xl"
    >
      :
    </span>
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
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso))
}
