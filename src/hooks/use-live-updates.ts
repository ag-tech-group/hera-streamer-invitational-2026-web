import type { QueryKey } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { baseUrl } from "@/api/api"
import { getListMatchesV1TournamentsTournamentSlugMatchesGetQueryKey } from "@/api/generated/hooks/matches/matches"
import { getStreamV1StreamGetUrl } from "@/api/generated/hooks/stream/stream"
import {
  getGetStandingsV1TournamentsTournamentSlugStandingsGetQueryKey,
  getGetSummaryV1TournamentsTournamentSlugSummaryGetQueryKey,
  getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey,
  getGetTournamentDetailV1TournamentsTournamentSlugGetQueryKey,
} from "@/api/generated/hooks/tournaments/tournaments"
import { activeTournament } from "@/config/tournaments"
import { logger } from "@/lib/logger"

/**
 * SSE event types carried by the API's global `/v1/stream` nudge stream
 * (issue #4 contract). Each names the REST resource that just changed.
 */
const NUDGE_EVENTS = ["standings", "live", "matches"] as const
type NudgeEvent = (typeof NUDGE_EVENTS)[number]

/**
 * How long a tab may stay hidden before we drop its SSE connection (#285).
 *
 * Every open tab holds an `EventSource` on `/v1/stream`, and on the API's read
 * tier that connection occupies a server request slot for up to an hour
 * whether the tab is watched or not — the single largest driver of API
 * capacity, and mostly idle/abandoned background tabs (launch review: ~10/20
 * Cloud Run instances still held at ~276 active users; `/v1/stream` logged
 * ~249k connections/24h). Closing the stream while the tab is hidden returns
 * that seat.
 *
 * The grace period keeps a quick tab-flip — glancing at Discord mid-match, the
 * common AoE2-viewer move — from churning the connection: only a tab still
 * hidden when the timer fires sheds its seat, which is exactly the
 * idle/abandoned case this targets. It's deliberately short relative to the
 * ~1h hold, so even a brief hide reclaims the seat long before the recycle.
 */
const HIDDEN_GRACE_MS = 60_000

/**
 * Subscribes to the API's global Server-Sent Events stream and turns each
 * nudge into one or more TanStack Query invalidations.
 *
 * The stream carries no data: every event is a lightweight "something
 * changed" nudge (`{ polled_at }`), with the changed resource named by the
 * SSE `event:` field. On each nudge we invalidate the matching query keys —
 * the orval-generated REST hooks then refetch, so REST stays the single
 * source of truth (see CLAUDE.md -> Architecture). `:` heartbeat comments are
 * dropped by `EventSource` itself and never reach a handler.
 *
 * `EventSource` reconnects on its own, including across the API's ~hourly
 * Cloud Run connection recycle — no manual retry needed.
 *
 * The connection is tied to tab visibility (#285): a tab that stays hidden
 * past `HIDDEN_GRACE_MS` closes its stream to free the server seat, and
 * returning to the tab reopens it and refetches once to catch up on whatever
 * changed while it was disconnected. Only `visibilitychange` drives this — a
 * window that is visible but unfocused (e.g. the standings on a second
 * monitor) is exactly the viewer we want to keep live, so `blur`/`focus` are
 * intentionally not wired.
 */
export function useLiveUpdates(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const tournamentSlug = activeTournament.apiTournamentSlug
    const standingsKey =
      getGetStandingsV1TournamentsTournamentSlugStandingsGetQueryKey(
        tournamentSlug
      )
    const teamStandingsKey =
      getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey(
        tournamentSlug
      )
    const tournamentKey =
      getGetTournamentDetailV1TournamentsTournamentSlugGetQueryKey(
        tournamentSlug
      )
    const matchesKey =
      getListMatchesV1TournamentsTournamentSlugMatchesGetQueryKey(
        tournamentSlug
      )
    const summaryKey =
      getGetSummaryV1TournamentsTournamentSlugSummaryGetQueryKey(tournamentSlug)

    // The query keys invalidated for each nudge type. A `standings` nudge is
    // the standings poll — it refreshes the player standings, the team
    // standings (whose combined ratings derive from player ratings), and the
    // headline summary cards (#243, leaders derived from the same match data).
    // A `live` nudge changes a player's `in_match` (folded into each standings
    // row) and the host's `host_stream_live` (a derived flag on the tournament
    // record, #149), so it invalidates both the standings and the
    // tournament-detail query. `matches` has no consumer yet, so that
    // invalidation is a no-op; it is wired anyway to keep the stream layer
    // complete for when a matches view lands.
    const queryKeysFor: Record<NudgeEvent, QueryKey[]> = {
      standings: [standingsKey, teamStandingsKey, summaryKey],
      live: [standingsKey, tournamentKey],
      matches: [matchesKey],
    }

    // Every key the stream can refresh, invalidated together when a tab
    // returns from hidden — a single catch-up for whatever nudges were missed
    // while the connection was closed. Staying current while connected is
    // handled by the per-nudge invalidations above.
    const allKeys: QueryKey[] = [
      standingsKey,
      teamStandingsKey,
      tournamentKey,
      matchesKey,
      summaryKey,
    ]

    // Fire-and-forget invalidate, but catch the returned promise: a burst of
    // nudges (or a resume catch-up) can invalidate a query whose refetch is
    // still in flight, and React Query aborts that request — rejecting with
    // AbortError. The abort is intentional (the newer invalidation refetches),
    // and any real refetch failure already surfaces via the query's own error
    // state, so the rejection must not escape as an unhandled rejection.
    const invalidate = (
      queryKey: QueryKey,
      context: Record<string, unknown>
    ): void => {
      void queryClient
        .invalidateQueries({ queryKey })
        .catch((error: unknown) => {
          logger.debug("SSE-triggered invalidation rejected", {
            ...context,
            error,
          })
        })
    }

    // The live connection, or null while disconnected (hidden tab, or mounted
    // hidden and not yet revealed). Held in the effect closure rather than a
    // ref because its whole lifecycle lives inside this effect.
    let source: EventSource | null = null

    const connect = (): void => {
      if (source) return
      const es = new EventSource(`${baseUrl}${getStreamV1StreamGetUrl()}`)
      source = es

      for (const event of NUDGE_EVENTS) {
        es.addEventListener(event, () => {
          logger.debug("SSE nudge received", { event })
          for (const queryKey of queryKeysFor[event]) {
            invalidate(queryKey, { event })
          }
        })
      }

      es.onopen = (): void => {
        logger.debug("SSE stream connected")
      }
      es.onerror = (): void => {
        // EventSource reconnects on its own; a CLOSED state means it gave up.
        if (es.readyState === EventSource.CLOSED) {
          logger.warn("SSE stream closed; live updates have stopped")
        } else {
          logger.debug("SSE stream interrupted; reconnecting")
        }
      }
    }

    const disconnect = (): void => {
      if (!source) return
      // close() ends the HTTP request, which the server sees as a client
      // disconnect and frees the seat. The instance's listeners go with it.
      source.close()
      source = null
    }

    // Pending hidden -> close timer; `undefined` when none is scheduled.
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined

    const clearHiddenTimer = (): void => {
      if (hiddenTimer !== undefined) {
        clearTimeout(hiddenTimer)
        hiddenTimer = undefined
      }
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        // Defer the close: a quick tab-flip shouldn't churn the connection.
        // Only schedule one if currently connected and none is pending.
        if (source && hiddenTimer === undefined) {
          hiddenTimer = setTimeout(() => {
            hiddenTimer = undefined
            logger.debug("SSE stream dropped while tab hidden")
            disconnect()
          }, HIDDEN_GRACE_MS)
        }
      } else {
        // Back in the foreground: cancel any pending drop, reopen if the seat
        // was already released, and refetch once to catch up on what we missed.
        clearHiddenTimer()
        if (!source) {
          connect()
          for (const queryKey of allKeys) {
            invalidate(queryKey, { reason: "resume" })
          }
        }
      }
    }

    // Open immediately when mounted in a visible tab. If mounted hidden (e.g. a
    // background tab opened via middle-click), hold off — the first
    // visibilitychange to visible connects, so we never hold a seat for a tab
    // the user has not actually looked at.
    if (document.visibilityState === "visible") {
      connect()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearHiddenTimer()
      disconnect()
    }
  }, [queryClient])
}
