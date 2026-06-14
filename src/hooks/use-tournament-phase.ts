import { useEffect, useState } from "react"

import { useTournament } from "@/hooks/use-tournament"

/**
 * Where the tournament sits in its lifecycle, derived purely from the
 * tournament record's dates — no extra API call:
 *
 * - `loading` — the tournament record hasn't resolved yet.
 * - `before`  — now is before `startDate` (or no start is set): not begun.
 * - `active`  — the ladder race is running (`startDate` passed, `endDate` not).
 * - `ended`   — `endDate` has passed: the race is over, the standings final.
 *
 * `endDate` is the *rated ladder-race* end (June 16 18:00 GMT for The King's
 * Gauntlet), NOT the playoffs/grand finals — those run later and are surfaced
 * separately from the tournament presentation bag (#363). See
 * {@link TournamentInfo.endDate}.
 */
export type TournamentPhase = "loading" | "before" | "active" | "ended"

/** setTimeout's 32-bit delay ceiling (~24.8 days). Past this it overflows and
 *  fires immediately, so we don't arm a timer for a boundary further out. */
const MAX_TIMEOUT_MS = 2_147_483_647

/**
 * Pure date→phase classifier, split out so it can be unit-tested without
 * standing up the query layer. Precedence is ended → active → before, so a
 * tournament whose dates are both in the past resolves to `ended`, and the
 * start instant counts as `active` (inclusive).
 */
export function derivePhase(
  now: number,
  startDate: string | null | undefined,
  endDate: string | null | undefined
): Exclude<TournamentPhase, "loading"> {
  const endMs = endDate ? new Date(endDate).getTime() : null
  if (endMs !== null && now >= endMs) return "ended"
  const startMs = startDate ? new Date(startDate).getTime() : null
  if (startMs !== null && now >= startMs) return "active"
  return "before"
}

/**
 * Reactive tournament phase. Re-evaluates exactly at the next date boundary
 * (race start, then race end) via a single scheduled timer rather than
 * per-second polling, so the page transitions live the moment the race ends on
 * stream — no reload, no idle interval while nothing is about to change.
 */
export function useTournamentPhase(): TournamentPhase {
  const { data } = useTournament()
  const [now, setNow] = useState(() => Date.now())

  const startMs = data?.startDate ? new Date(data.startDate).getTime() : null
  const endMs = data?.endDate ? new Date(data.endDate).getTime() : null

  useEffect(() => {
    // The soonest boundary still in the future is when the phase next changes.
    const next = [startMs, endMs]
      .filter((ms): ms is number => ms !== null && ms > now)
      .sort((a, b) => a - b)[0]
    if (next === undefined || next - now > MAX_TIMEOUT_MS) return
    // +50ms so the timer fires a hair *after* the boundary, never just before
    // it (which would re-classify to the same phase and re-arm in a tight loop).
    const id = setTimeout(() => setNow(Date.now()), next - now + 50)
    return () => clearTimeout(id)
  }, [startMs, endMs, now])

  if (!data) return "loading"
  return derivePhase(now, data.startDate, data.endDate)
}
