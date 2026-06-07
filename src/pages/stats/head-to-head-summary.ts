import type { HeadToHeadGame } from "@/types"

/**
 * The player who has won the most head-to-head games in the loaded feed (#349) —
 * backs the summary card above the table.
 */
export interface HeadToHeadLeader {
  /** Stable roster identity (#281), shared with the player's standings row. */
  tournamentPlayerId: number
  /** Resolved display label, taken from the entrant rows. */
  name: string
  /** Head-to-head wins across the loaded games. */
  wins: number
  /** Head-to-head losses across the loaded games (used only to break ties). */
  losses: number
}

/**
 * Picks the top head-to-head winner from the loaded games (#349): the player
 * with the most wins, breaking ties by fewest losses and then name, so the
 * result is deterministic. Tallies over whatever games the feed has fetched
 * (the endpoint's newest-first window), which is effectively all of them while
 * head-to-head data stays sparse. Returns `null` when no game has a decided
 * winner yet (an empty feed, or only in-progress games).
 */
export function topHeadToHeadWinner(
  games: HeadToHeadGame[]
): HeadToHeadLeader | null {
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

  const ranked = [...byPlayer.values()]
    .filter((player) => player.wins > 0)
    .sort(
      (a, b) =>
        b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name)
    )
  return ranked[0] ?? null
}
