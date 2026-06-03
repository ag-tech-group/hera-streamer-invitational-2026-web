import { civEmblemUrl } from "@/lib/civilizations"
import type { TeamColorSlot } from "@/lib/team-colors"
import type { CivCount, PlayerCivCounts, TeamStandingsRow } from "@/types"

/**
 * Per-player and per-team civ identity for the "Civs by team" stats section
 * (#302 follow-up). Derived entirely from the API's `/civ-stats` `by_player`
 * breakdown joined to the team rosters — no new endpoint.
 *
 * Each team gets its most-played civs and its best-performing civs, aggregated
 * across the roster; each member gets the civs they main (their top picks). The
 * team's win-rate list is gated by a minimum pick count so a 1–0 civ can't
 * headline it (`topByWin`); the pick lists are ungated — picks are picks.
 */

/** A civ in a top-N list, resolved for display. */
export interface CivTop {
  civId: number
  name: string
  emblemUrl: string | null
  picks: number
  wins: number
  /** Win rate 0–100 (raw). The win-rate list gates which civs qualify, not this. */
  winPct: number
}

/** One member's civ identity: the civs they main. */
export interface PlayerCivSummary {
  tournamentPlayerId: number
  label: string
  topPicks: CivTop[]
}

/** A team's civ identity: team-wide tops, then each member's. */
export interface TeamCivGroup {
  teamId: number
  name: string
  /** Team palette slot (p1–p8) — drives the card's `data-team-color` treatment. */
  colorSlot: TeamColorSlot
  topPicks: CivTop[]
  topWins: CivTop[]
  players: PlayerCivSummary[]
}

const TOP_N = 3

export interface CivByTeamOpts {
  /** `displayName ?? name` per entrant — the civ payload carries no label. */
  labelByTournamentPlayerId: Map<number, string>
  /** Team palette slot (p1–p8) per team. */
  slotByTeamId: Map<number, TeamColorSlot>
  /** Min picks for a civ to enter a *team's* win-rate top-N. */
  minTeamWinPicks: number
}

/** Resolves a civ count to a display row, or null when the API couldn't name it. */
function toCivTop(c: CivCount): CivTop | null {
  if (c.name === null) return null // can't label an unresolved civ
  return {
    civId: c.civId,
    name: c.name,
    emblemUrl: civEmblemUrl(c.name),
    picks: c.picks,
    wins: c.wins,
    winPct: c.picks > 0 ? (c.wins / c.picks) * 100 : 0,
  }
}

/** Top-N by picks (desc), win% then name as tiebreaks. */
function topByPicks(civs: CivTop[]): CivTop[] {
  return [...civs]
    .sort(
      (a, b) =>
        b.picks - a.picks || b.winPct - a.winPct || a.name.localeCompare(b.name)
    )
    .slice(0, TOP_N)
}

/** Top-N by win% (desc) among civs over the pick gate, picks then name next. */
function topByWin(civs: CivTop[], minPicks: number): CivTop[] {
  return civs
    .filter((c) => c.picks >= minPicks)
    .sort(
      (a, b) =>
        b.winPct - a.winPct || b.picks - a.picks || a.name.localeCompare(b.name)
    )
    .slice(0, TOP_N)
}

/** Sums picks/wins per civ across several players' counts (team aggregate). */
function aggregate(perPlayer: CivCount[][]): CivTop[] {
  const byCiv = new Map<number, { name: string; picks: number; wins: number }>()
  for (const civs of perPlayer) {
    for (const c of civs) {
      if (c.name === null) continue
      const e = byCiv.get(c.civId)
      if (e) {
        e.picks += c.picks
        e.wins += c.wins
      } else {
        byCiv.set(c.civId, { name: c.name, picks: c.picks, wins: c.wins })
      }
    }
  }
  return [...byCiv.entries()].flatMap(([civId, v]) => {
    const top = toCivTop({ civId, name: v.name, picks: v.picks, wins: v.wins })
    return top ? [top] : []
  })
}

/**
 * Builds the per-team civ groups. Players with no civ data (no completed
 * in-window games) are omitted; a team with no playing members yields empty
 * tops (the component renders a "no games yet" state).
 */
export function toCivByTeam(
  byPlayer: PlayerCivCounts[],
  teamRows: TeamStandingsRow[],
  opts: CivByTeamOpts
): TeamCivGroup[] {
  const civsByPlayer = new Map(
    byPlayer.map((p) => [p.tournamentPlayerId, p.civs])
  )
  // Fixed order by teamId (≈ creation order) so the cards match the colour
  // palette (blue, red, green, …) and never reshuffle: the API serves teams in
  // live-rank order, but a standings reorder must not move a team's card on
  // broadcast.
  return [...teamRows]
    .sort((a, b) => a.teamId - b.teamId)
    .map((team) => {
      const players = team.members.flatMap<PlayerCivSummary>((m) => {
        const civs = civsByPlayer.get(m.tournamentPlayerId)
        if (!civs || civs.length === 0) return []
        const tops = civs.flatMap((c) => {
          const t = toCivTop(c)
          return t ? [t] : []
        })
        return [
          {
            tournamentPlayerId: m.tournamentPlayerId,
            label:
              opts.labelByTournamentPlayerId.get(m.tournamentPlayerId) ?? "—",
            topPicks: topByPicks(tops),
          },
        ]
      })
      const teamCivs = aggregate(
        team.members.flatMap((m) => {
          const c = civsByPlayer.get(m.tournamentPlayerId)
          return c ? [c] : []
        })
      )
      return {
        teamId: team.teamId,
        name: team.name,
        colorSlot: opts.slotByTeamId.get(team.teamId) ?? "p1",
        topPicks: topByPicks(teamCivs),
        topWins: topByWin(teamCivs, opts.minTeamWinPicks),
        players,
      }
    })
}
