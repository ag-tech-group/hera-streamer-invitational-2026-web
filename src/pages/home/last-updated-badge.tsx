import { useEffect, useState } from "react"

import { formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

/** How often the elapsed-time label recomputes. */
const TICK_MS = 1000
/** Past this age, the badge dims to flag that the data may be stale. */
const STALE_AFTER_MS = 2 * 60 * 1000

/**
 * A small "Updated 12s ago" badge that ticks once a second.
 *
 * Driven by the standings snapshot's `lastPolledAt` (the API's
 * `last_polled_at`). Because the label keeps counting up between refetches,
 * it doubles as a liveness signal: if SSE nudges dry up, the rising number is
 * the user's cue that data has gone stale — no separate "disconnected" state
 * needed. Renders nothing until the first successful poll.
 */
export function LastUpdatedBadge({
  lastPolledAt,
}: {
  lastPolledAt: string | null
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  if (!lastPolledAt) return null

  const stale = now - new Date(lastPolledAt).getTime() > STALE_AFTER_MS

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
        stale ? "text-muted-foreground" : "text-foreground"
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        {!stale && (
          <span className="bg-chart-2 absolute inline-flex size-full animate-ping rounded-full opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            stale ? "bg-muted-foreground/50" : "bg-chart-2"
          )}
        />
      </span>
      Updated {formatTimeAgo(lastPolledAt, new Date(now))}
    </span>
  )
}
