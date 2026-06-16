import { describe, expect, it } from "vitest"

import { topHeadToHeadWinners } from "@/pages/stats/head-to-head-summary"
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

describe("topHeadToHeadWinners", () => {
  it("returns an empty array for an empty feed", () => {
    expect(topHeadToHeadWinners([])).toEqual([])
  })

  it("returns the sole winner of a single game with a 1–0 record", () => {
    const leaders = topHeadToHeadWinners([game(VIPER, HERA)])
    expect(leaders).toHaveLength(1)
    expect(leaders[0]).toMatchObject({
      tournamentPlayerId: 1,
      name: "TheViper",
      wins: 1,
      losses: 0,
    })
  })

  it("counts wins and losses across games and picks the most wins", () => {
    const leaders = topHeadToHeadWinners([
      game(VIPER, HERA, 1),
      game(VIPER, LIEREYY, 2),
      game(HERA, LIEREYY, 3),
    ])
    // Viper 2–0, Hera 1–1, Liereyy 0–2 — Viper is the sole leader.
    expect(leaders).toHaveLength(1)
    expect(leaders[0]).toMatchObject({ name: "TheViper", wins: 2, losses: 0 })
  })

  it("returns every player level on the most wins, fewest losses first", () => {
    const leaders = topHeadToHeadWinners([
      // Hera 2–0; Viper 2–1 — both lead on wins, Hera ahead on losses.
      game(VIPER, LIEREYY, 1),
      game(VIPER, LIEREYY, 2),
      game(LIEREYY, VIPER, 3),
      game(HERA, LIEREYY, 4),
      game(HERA, LIEREYY, 5),
    ])
    expect(leaders.map((leader) => leader.name)).toEqual(["Hera", "TheViper"])
    expect(leaders[0]).toMatchObject({ name: "Hera", wins: 2, losses: 0 })
    expect(leaders[1]).toMatchObject({ name: "TheViper", wins: 2, losses: 1 })
  })

  it("surfaces a three-way tie, ordered by name when records match", () => {
    // A rock-paper-scissors cycle: each player finishes 1–1.
    const leaders = topHeadToHeadWinners([
      game(VIPER, HERA, 1),
      game(HERA, LIEREYY, 2),
      game(LIEREYY, VIPER, 3),
    ])
    expect(leaders.map((leader) => leader.name)).toEqual([
      "Hera",
      "Liereyy",
      "TheViper",
    ])
    expect(leaders.every((leader) => leader.wins === 1)).toBe(true)
  })

  it("ignores players with no wins", () => {
    // Liereyy only ever loses, so is never a leader.
    const leaders = topHeadToHeadWinners([game(VIPER, LIEREYY, 1)])
    expect(leaders.map((leader) => leader.name)).toEqual(["TheViper"])
  })
})
