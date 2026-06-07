import { describe, expect, it } from "vitest"

import { topHeadToHeadWinner } from "@/pages/stats/head-to-head-summary"
import type { HeadToHeadEntrant, HeadToHeadGame } from "@/types"

type Side = [tournamentPlayerId: number, name: string]

function entrant(
  [tournamentPlayerId, name]: Side,
  outcome: HeadToHeadEntrant["outcome"]
): HeadToHeadEntrant {
  return {
    tournamentPlayerId,
    profileId: tournamentPlayerId * 10,
    name,
    civId: 1,
    civName: "Franks",
    civEmblemUrl: null,
    oldRating: 1800,
    newRating: 1810,
    outcome,
  }
}

/** A completed game, winner first (the API/adapter ordering). */
function game(winner: Side, loser: Side, matchId = 1): HeadToHeadGame {
  return {
    matchId,
    mapName: "Arabia",
    startedAt: "2026-06-03T18:00:00Z",
    completedAt: "2026-06-03T18:20:00Z",
    durationSeconds: 1200,
    matchUrl: `https://www.aoe2insights.com/match/${matchId}/`,
    entrants: [entrant(winner, "win"), entrant(loser, "loss")],
  }
}

const VIPER: Side = [1, "TheViper"]
const HERA: Side = [2, "Hera"]
const LIEREYY: Side = [3, "Liereyy"]

describe("topHeadToHeadWinner", () => {
  it("returns null for an empty feed", () => {
    expect(topHeadToHeadWinner([])).toBeNull()
  })

  it("returns the sole winner of a single game with a 1–0 record", () => {
    const leader = topHeadToHeadWinner([game(VIPER, HERA)])
    expect(leader).toMatchObject({
      tournamentPlayerId: 1,
      name: "TheViper",
      wins: 1,
      losses: 0,
    })
  })

  it("counts wins and losses across games and picks the most wins", () => {
    const leader = topHeadToHeadWinner([
      game(VIPER, HERA, 1),
      game(VIPER, LIEREYY, 2),
      game(HERA, LIEREYY, 3),
    ])
    // Viper 2–0, Hera 1–1, Liereyy 0–2.
    expect(leader).toMatchObject({ name: "TheViper", wins: 2, losses: 0 })
  })

  it("breaks a win tie by fewest losses", () => {
    const leader = topHeadToHeadWinner([
      // Hera 2–0; Viper 2–1.
      game(VIPER, LIEREYY, 1),
      game(VIPER, LIEREYY, 2),
      game(LIEREYY, VIPER, 3),
      game(HERA, LIEREYY, 4),
      game(HERA, LIEREYY, 5),
    ])
    expect(leader).toMatchObject({ name: "Hera", wins: 2, losses: 0 })
  })

  it("breaks a fully tied record by name", () => {
    // Both 1–0; "Hera" sorts before "TheViper".
    const leader = topHeadToHeadWinner([
      game(VIPER, LIEREYY, 1),
      game(HERA, LIEREYY, 2),
    ])
    expect(leader?.name).toBe("Hera")
  })

  it("ignores players with no wins", () => {
    // Liereyy only ever loses, so is never the leader.
    const leader = topHeadToHeadWinner([game(VIPER, LIEREYY, 1)])
    expect(leader?.name).toBe("TheViper")
  })
})
