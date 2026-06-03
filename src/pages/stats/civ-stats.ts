import { civById } from "@/lib/civilizations"
import type { Match } from "@/types"

/** One civilization's aggregate over the tournament's matches. */
export interface CivStat {
  civId: number
  name: string
  /** Emblem basename → `public/civ-emblems/<emblem>.webp`. */
  emblem: string
  /** Games this civ was played in (completed-match player rows). */
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
  /** Completed matches the stats were computed over (for the sample caption). */
  matchCount: number
  /** Minimum picks a civ needs to appear in the win-rate view. */
  minPicks: number
}

/**
 * Aggregates per-civ pick + win rates from the tournament matches (#302).
 *
 * Counts each completed-match player row as one "pick" of that civ, and a win
 * when its outcome is `win`. Unknown civ ids (Gaia, or a civ newer than the
 * static map) are skipped rather than labelled. Win rate is only computed for
 * civs with at least `minPicks` games — so a 1–0 civ can't top the win board —
 * while every civ still counts toward pick rate. In-progress / staging matches
 * are ignored (no settled outcome).
 */
export function toCivStats(matches: Match[], minPicks: number): CivStats {
  const agg = new Map<number, { picks: number; wins: number }>()
  let matchCount = 0
  for (const m of matches) {
    if (m.state !== "completed") continue
    matchCount++
    for (const p of m.players) {
      if (!civById(p.civilizationId)) continue
      const a = agg.get(p.civilizationId) ?? { picks: 0, wins: 0 }
      a.picks++
      if (p.outcome === "win") a.wins++
      agg.set(p.civilizationId, a)
    }
  }

  const stats: CivStat[] = [...agg.entries()].map(([civId, a]) => {
    const civ = civById(civId)!
    return {
      civId,
      name: civ.name,
      emblem: civ.emblem,
      picks: a.picks,
      wins: a.wins,
      winPct: a.picks >= minPicks ? (a.wins / a.picks) * 100 : null,
    }
  })

  const byPicks = [...stats].sort(
    (a, b) => b.picks - a.picks || a.name.localeCompare(b.name)
  )
  const byWinPct = stats
    .filter((s): s is CivStat & { winPct: number } => s.winPct !== null)
    .sort((a, b) => b.winPct - a.winPct || b.picks - a.picks)

  return { byPicks, byWinPct, matchCount, minPicks }
}
