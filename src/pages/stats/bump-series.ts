import { lightenHex } from "@/lib/team-colors"
import type { LabeledSeries } from "@/pages/stats/series-labels"

/** One node of a bump line: a player's leaderboard rank on one bucket day. */
export interface BumpPoint {
  /** Bucket timestamp — the UTC day midnight this rank is measured at (ms). */
  t: number
  /** Full-field leaderboard rank (1 = highest rating), or null before the
   *  player's first match (no node drawn — the line starts at their debut). */
  rank: number | null
  /** The player's held rating at this bucket (for the tooltip), or null. */
  rating: number | null
}

/** One player's rank-over-time trajectory, ready for the bump chart. */
export interface BumpSeries {
  tournamentPlayerId: number
  label: string
  /** Line colour: the player's team hue, shaded per teammate (see below). */
  color: string
  points: BumpPoint[]
}

const DAY_MS = 86_400_000
/** Lightening spread across a team's shown players, base hue → lightest. */
const SHADE_MAX = 0.45
/** Fallback when a series' player isn't found on any team roster. */
const NEUTRAL_HEX = "#94a3b8"

interface ParsedSeries {
  tournamentPlayerId: number
  label: string
  /** `[ms, rating]` oldest-first (the API contract). */
  pts: Array<[number, number]>
}

/**
 * Derives the rank bump chart (#299) from the progression series, client-side.
 *
 * The leaderboard is recomputed at one bucket per UTC day: each player's rating
 * is forward-filled to the end of the day (a stopped player holds their last
 * rating, so others passing them register as a *slide*), then everyone with a
 * rating is ranked high-to-low. Ranks are over the **full field**, not just the
 * shown lines — so a climb from 12th to 5th reads as a climb, which ranking
 * only among the leaders would hide (it could even invert it).
 *
 * Shown lines are every player who reached the top `topN` in **any** bucket —
 * the surgers and the sliders. That set only grows as the tournament runs (a
 * past day's top-N can't change — its matches are complete), so the chart's
 * series stay append-only and a plain merge never strands a ghost line, the
 * same guarantee the rating chart relies on.
 *
 * Lines are team-coloured; teammates among the shown set are shaded apart
 * within the team hue (base hue for the best-ranked, lightening outward) so
 * same-team lines stay distinguishable while the team story still reads.
 */
export function toBumpSeries(
  series: LabeledSeries[],
  opts: {
    teamIdByTournamentPlayerId: Map<number, number>
    baseHexByTeamId: Map<number, string>
    topN: number
  }
): BumpSeries[] {
  const parsed: ParsedSeries[] = series
    .map((s) => ({
      tournamentPlayerId: s.tournamentPlayerId,
      label: s.label,
      pts: s.points.map(
        (p) => [Date.parse(p.completedAt), p.rating] as [number, number]
      ),
    }))
    .filter((s) => s.pts.length > 0)
  if (parsed.length === 0) return []

  const allMs = parsed.flatMap((s) => s.pts.map(([ms]) => ms))
  const firstDay = Math.floor(Math.min(...allMs) / DAY_MS) * DAY_MS
  const lastDay = Math.floor(Math.max(...allMs) / DAY_MS) * DAY_MS
  const buckets: number[] = []
  for (let d = firstDay; d <= lastDay; d += DAY_MS) buckets.push(d)

  // Forward-fill each player's rating to the end of every bucket day. `pts` are
  // oldest-first, so a single advancing pointer fills the row in one pass.
  const ratingByPlayer = new Map<number, Array<number | null>>()
  for (const s of parsed) {
    const row: Array<number | null> = []
    let i = 0
    let held: number | null = null
    for (const day of buckets) {
      const endOfDay = day + DAY_MS
      while (i < s.pts.length && s.pts[i][0] < endOfDay) {
        held = s.pts[i][1]
        i++
      }
      row.push(held)
    }
    ratingByPlayer.set(s.tournamentPlayerId, row)
  }

  // Rank the full field within each bucket: highest rating is rank 1, ties
  // broken by id for a stable order. Unrated players (no match yet) get null.
  const rankByPlayer = new Map<number, Array<number | null>>(
    parsed.map((s) => [s.tournamentPlayerId, []])
  )
  for (let b = 0; b < buckets.length; b++) {
    const rated = parsed
      .map((s) => ({
        id: s.tournamentPlayerId,
        rating: ratingByPlayer.get(s.tournamentPlayerId)![b],
      }))
      .filter((e): e is { id: number; rating: number } => e.rating !== null)
      .sort((a, b) => b.rating - a.rating || a.id - b.id)
    const rankOf = new Map(rated.map((e, idx) => [e.id, idx + 1]))
    for (const s of parsed) {
      rankByPlayer
        .get(s.tournamentPlayerId)!
        .push(rankOf.get(s.tournamentPlayerId) ?? null)
    }
  }

  // Shown = every player who reached the top N in any bucket, ordered by their
  // current (last-bucket) rank so the legend reads like the live leaderboard.
  const lastBucket = buckets.length - 1
  const shown = parsed
    .map((s) => {
      const ranks = rankByPlayer.get(s.tournamentPlayerId)!
      return {
        series: s,
        bestRank: Math.min(
          ...ranks.filter((r): r is number => r !== null),
          Infinity
        ),
        latestRank: ranks[lastBucket],
      }
    })
    .filter((e) => e.bestRank <= opts.topN)
    .sort((a, b) => (a.latestRank ?? Infinity) - (b.latestRank ?? Infinity))

  const colorByPlayer = shadeByTeam(
    shown.map((e) => e.series.tournamentPlayerId),
    opts.teamIdByTournamentPlayerId,
    opts.baseHexByTeamId
  )

  return shown.map((e) => {
    const ranks = rankByPlayer.get(e.series.tournamentPlayerId)!
    const ratings = ratingByPlayer.get(e.series.tournamentPlayerId)!
    return {
      tournamentPlayerId: e.series.tournamentPlayerId,
      label: e.series.label,
      color: colorByPlayer.get(e.series.tournamentPlayerId)!,
      points: buckets.map((t, b) => ({
        t,
        rank: ranks[b],
        rating: ratings[b],
      })),
    }
  })
}

/**
 * Assigns each shown player a colour: their team's base hue for the best-ranked
 * teammate, lightening across the rest so same-team lines separate. `shownIds`
 * arrives already ordered by current rank, so the team's leader keeps the
 * fullest hue.
 */
function shadeByTeam(
  shownIds: number[],
  teamIdByTournamentPlayerId: Map<number, number>,
  baseHexByTeamId: Map<number, string>
): Map<number, string> {
  const teammates = new Map<number, number[]>()
  for (const id of shownIds) {
    const teamId = teamIdByTournamentPlayerId.get(id) ?? -1
    const group = teammates.get(teamId)
    if (group) group.push(id)
    else teammates.set(teamId, [id])
  }
  const color = new Map<number, string>()
  for (const [teamId, ids] of teammates) {
    const base = baseHexByTeamId.get(teamId) ?? NEUTRAL_HEX
    ids.forEach((id, k) => {
      color.set(
        id,
        ids.length > 1
          ? lightenHex(base, (k / (ids.length - 1)) * SHADE_MAX)
          : base
      )
    })
  }
  return color
}
