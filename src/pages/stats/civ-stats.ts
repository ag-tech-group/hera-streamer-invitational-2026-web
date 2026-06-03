import { civEmblemUrl } from "@/lib/civilizations"
import type { CivCount } from "@/types"

/** One civilization's aggregate, resolved for display. */
export interface CivStat {
  civId: number
  name: string
  /** Resolved emblem URL, or `null` when we have no shield for this civ. */
  emblemUrl: string | null
  /** Games an entrant played this civ (over the whole tournament). */
  picks: number
  wins: number
  /** Win rate 0–100, or `null` when picks are below the threshold. */
  winPct: number | null
}

/** The two civ views plus the sample context. */
export interface CivStats {
  /** Every picked civ, most-played first. */
  byPicks: CivStat[]
  /** Civs meeting the min-pick threshold, highest win rate first. */
  byWinPct: CivStat[]
  /** Total entrant picks the stats cover (the sample caption). */
  matchCount: number
  /** Minimum picks a civ needs to appear in the win-rate view. */
  minPicks: number
}

/**
 * Derives the two civ views from the API's `/civ-stats` aggregate (#302).
 *
 * The API already counts entrants' picks/wins per civ over the whole
 * tournament (opponents excluded) and now names each civ, so this just attaches
 * the emblem (resolved from the name), computes win rate, and orders the two
 * views. Win rate is only shown for civs with at least `minPicks` games — so a
 * 1–0 civ can't top the board — while every civ still counts toward pick rate.
 * A civ the API couldn't name is skipped (nothing to label the row with); one
 * we have no shield for still shows, name-only.
 */
export function toCivStats(overall: CivCount[], minPicks: number): CivStats {
  const stats: CivStat[] = overall.flatMap((c) => {
    if (c.name === null) return []
    return [
      {
        civId: c.civId,
        name: c.name,
        emblemUrl: civEmblemUrl(c.name),
        picks: c.picks,
        wins: c.wins,
        winPct: c.picks >= minPicks ? (c.wins / c.picks) * 100 : null,
      },
    ]
  })

  const matchCount = stats.reduce((sum, c) => sum + c.picks, 0)
  const byPicks = [...stats].sort(
    (a, b) => b.picks - a.picks || a.name.localeCompare(b.name)
  )
  const byWinPct = stats
    .filter((s): s is CivStat & { winPct: number } => s.winPct !== null)
    .sort((a, b) => b.winPct - a.winPct || b.picks - a.picks)

  return { byPicks, byWinPct, matchCount, minPicks }
}
