import type { QueryKey } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { baseUrl } from "@/api/api"
import { getGetStandingsV1LeaderboardsLeaderboardIdStandingsGetQueryKey } from "@/api/generated/hooks/leaderboards/leaderboards"
import { getGetLiveV1LiveGetQueryKey } from "@/api/generated/hooks/live/live"
import { getListMatchesV1MatchesGetQueryKey } from "@/api/generated/hooks/matches/matches"
import { getStreamV1StreamGetUrl } from "@/api/generated/hooks/stream/stream"
import { activeTournament } from "@/config/tournaments"
import { logger } from "@/lib/logger"

/**
 * SSE event types carried by the API's global `/v1/stream` nudge stream
 * (issue #4 contract). Each names the REST resource that just changed.
 */
const NUDGE_EVENTS = ["standings", "live", "matches"] as const
type NudgeEvent = (typeof NUDGE_EVENTS)[number]

/**
 * Subscribes to the API's global Server-Sent Events stream and turns each
 * nudge into a TanStack Query invalidation.
 *
 * The stream carries no data: every event is a lightweight "something
 * changed" nudge (`{ polled_at }`), with the changed resource named by the
 * SSE `event:` field. On each nudge we invalidate the matching query key —
 * the orval-generated REST hook then refetches, so REST stays the single
 * source of truth (see CLAUDE.md -> Architecture). `:` heartbeat comments are
 * dropped by `EventSource` itself and never reach a handler.
 *
 * `EventSource` reconnects on its own, including across the API's ~hourly
 * Cloud Run connection recycle — no manual retry needed.
 */
export function useLiveUpdates(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    // The query key invalidated for each nudge type. `live` and `matches`
    // have no consumer yet, so those invalidations are currently no-ops —
    // wiring them now keeps the stream layer complete for when those views
    // land, with no change needed here.
    const queryKeyFor: Record<NudgeEvent, QueryKey> = {
      standings: getGetStandingsV1LeaderboardsLeaderboardIdStandingsGetQueryKey(
        activeTournament.leaderboardId
      ),
      live: getGetLiveV1LiveGetQueryKey(),
      matches: getListMatchesV1MatchesGetQueryKey(),
    }

    const source = new EventSource(`${baseUrl}${getStreamV1StreamGetUrl()}`)

    const subscriptions = NUDGE_EVENTS.map((event) => {
      const handler = (): void => {
        logger.debug("SSE nudge received", { event })
        void queryClient.invalidateQueries({ queryKey: queryKeyFor[event] })
      }
      source.addEventListener(event, handler)
      return { event, handler }
    })

    source.onopen = (): void => {
      logger.debug("SSE stream connected")
    }
    source.onerror = (): void => {
      // EventSource reconnects on its own; a CLOSED state means it gave up.
      if (source.readyState === EventSource.CLOSED) {
        logger.warn("SSE stream closed; live updates have stopped")
      } else {
        logger.debug("SSE stream interrupted; reconnecting")
      }
    }

    return () => {
      for (const { event, handler } of subscriptions) {
        source.removeEventListener(event, handler)
      }
      source.close()
    }
  }, [queryClient])
}
