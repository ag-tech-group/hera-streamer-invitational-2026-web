import type { HeadToHeadGame } from "@/types"

/**
 * A player who shares the most head-to-head wins in the loaded feed (#349) —
 * backs the summary card above the table. There can be more than one when
 * several players are level on wins (a tie for the lead).
 */
export interface HeadToHeadLeader {
  /** Stable roster identity (#281), shared with the player's standings row. */
  tournamentPlayerId: number
  /** Resolved display label, taken from the entrant rows. */
  name: string
  /** Head-to-head wins across the loaded games. */
  wins: number
  /** Head-to-head losses across the loaded games (orders tied leaders). */
  losses: number
}

/**
 * The head-to-head leaders from the loaded games (#349): every player level on
 * the most wins, so a tie for the lead surfaces all of them rather than hiding
 * the rest behind a tiebreak. The card is framed by win count ("Most
 * head-to-head wins"), so the tie is on wins alone — a 2–0 and a 2–1 player are
 * both leaders; losses only order the tied names (fewest first, then by name)
 * for a stable display. Tallies over whatever games the feed has fetched (the
 * endpoint's newest-first window), which is effectively all of them while
 * head-to-head data stays sparse. Returns an empty array when no game has a
 * decided winner yet (an empty feed, or only in-progress games).
 */
export function topHeadToHeadWinners(
  games: HeadToHeadGame[]
): HeadToHeadLeader[] {
  const byPlayer = new Map<number, HeadToHeadLeader>()
  for (const game of games) {
    for (const entrant of game.entrants) {
      const tally = byPlayer.get(entrant.tournamentPlayerId) ?? {
        tournamentPlayerId: entrant.tournamentPlayerId,
        name: entrant.name,
        wins: 0,
        losses: 0,
      }
      if (entrant.outcome === "win") tally.wins += 1
      else if (entrant.outcome === "loss") tally.losses += 1
      // Keep the latest seen name (newest game first), so a rename resolves to
      // the most recent label.
      tally.name = entrant.name
      byPlayer.set(entrant.tournamentPlayerId, tally)
    }
  }

  const winners = [...byPlayer.values()].filter((player) => player.wins > 0)
  if (winners.length === 0) return []
  const mostWins = Math.max(...winners.map((player) => player.wins))
  return winners
    .filter((player) => player.wins === mostWins)
    .sort((a, b) => a.losses - b.losses || a.name.localeCompare(b.name))
}
