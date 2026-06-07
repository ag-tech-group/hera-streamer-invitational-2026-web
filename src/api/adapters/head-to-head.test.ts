import { describe, expect, it } from "vitest"

import { toHeadToHeadSnapshot } from "@/api/adapters/head-to-head"
import type { getHeadToHeadV1TournamentsTournamentSlugHeadToHeadGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { HeadToHeadMatch, HeadToHeadPlayer } from "@/api/generated/types"

function playerDto(
  overrides: Partial<HeadToHeadPlayer> = {}
): HeadToHeadPlayer {
  return {
    tournament_player_id: 1,
    profile_id: 100,
    name: "TheViper",
    civilization_id: 17,
    civilization_name: "Franks",
    old_rating: 1834,
    new_rating: 1850,
    outcome: "win",
    ...overrides,
  }
}

function matchDto(overrides: Partial<HeadToHeadMatch> = {}): HeadToHeadMatch {
  return {
    match_id: 424242,
    map_name: "Arabia.rms",
    started_at: "2026-06-03T18:00:00Z",
    completed_at: "2026-06-03T18:23:14Z",
    duration_seconds: 1394,
    entrants: [
      playerDto(),
      playerDto({
        tournament_player_id: 2,
        profile_id: 200,
        name: "Hera",
        civilization_id: 21,
        civilization_name: "Mayans",
        old_rating: 1798,
        new_rating: 1782,
        outcome: "loss",
      }),
    ],
    ...overrides,
  }
}

function responseOf(
  matches: HeadToHeadMatch[],
  lastPolledAt: string | null = "2026-06-03T18:24:00Z"
): getHeadToHeadV1TournamentsTournamentSlugHeadToHeadGetResponse {
  return {
    status: 200,
    data: { last_polled_at: lastPolledAt, items: matches },
    headers: new Headers(),
  }
}

describe("toHeadToHeadSnapshot", () => {
  it("maps the list envelope and camelCases game fields", () => {
    const snap = toHeadToHeadSnapshot(responseOf([matchDto()]))
    expect(snap.lastPolledAt).toBe("2026-06-03T18:24:00Z")
    expect(snap.games).toHaveLength(1)
    expect(snap.games[0]).toMatchObject({
      matchId: 424242,
      startedAt: "2026-06-03T18:00:00Z",
      completedAt: "2026-06-03T18:23:14Z",
      durationSeconds: 1394,
    })
  })

  it("cleans the replay map name (strips the .rms extension)", () => {
    expect(
      toHeadToHeadSnapshot(responseOf([matchDto()])).games[0].mapName
    ).toBe("Arabia")
  })

  it("builds the external aoe2insights match link from the relic match id", () => {
    expect(
      toHeadToHeadSnapshot(responseOf([matchDto()])).games[0].matchUrl
    ).toBe("https://www.aoe2insights.com/match/424242/")
  })

  it("preserves the winner-first entrant order and maps each side", () => {
    const [winner, loser] = toHeadToHeadSnapshot(responseOf([matchDto()]))
      .games[0].entrants
    expect(winner).toMatchObject({
      tournamentPlayerId: 1,
      profileId: 100,
      name: "TheViper",
      civId: 17,
      civName: "Franks",
      oldRating: 1834,
      newRating: 1850,
      outcome: "win",
    })
    expect(loser).toMatchObject({
      tournamentPlayerId: 2,
      name: "Hera",
      civName: "Mayans",
      oldRating: 1798,
      outcome: "loss",
    })
  })

  it("resolves each entrant's civ emblem by name", () => {
    const [winner, loser] = toHeadToHeadSnapshot(responseOf([matchDto()]))
      .games[0].entrants
    expect(winner.civEmblemUrl).toMatch(/franks\.webp$/)
    expect(loser.civEmblemUrl).toMatch(/mayans\.webp$/)
  })

  it("yields a null emblem (but keeps the name) for a civ with no committed shield", () => {
    const entrant = toHeadToHeadSnapshot(
      responseOf([
        matchDto({
          entrants: [
            playerDto({
              civilization_id: 99999,
              civilization_name: "Atlanteans", // not in our emblem set
            }),
          ],
        }),
      ])
    ).games[0].entrants[0]
    expect(entrant.civName).toBe("Atlanteans")
    expect(entrant.civEmblemUrl).toBeNull()
  })

  it("preserves nulls for a game missing a duration or ratings", () => {
    const game = toHeadToHeadSnapshot(
      responseOf([
        matchDto({
          duration_seconds: null,
          completed_at: null,
          entrants: [
            playerDto({ old_rating: null, new_rating: null, outcome: null }),
          ],
        }),
      ])
    ).games[0]
    expect(game.durationSeconds).toBeNull()
    expect(game.completedAt).toBeNull()
    expect(game.entrants[0]).toMatchObject({
      oldRating: null,
      newRating: null,
      outcome: null,
    })
  })

  it("returns an empty feed (not an error) when there are no games", () => {
    const snap = toHeadToHeadSnapshot(responseOf([], null))
    expect(snap.games).toEqual([])
    expect(snap.lastPolledAt).toBeNull()
  })

  it("throws on a non-200 response", () => {
    const bad = {
      status: 422,
      data: { detail: [] },
      headers: new Headers(),
    } as unknown as getHeadToHeadV1TournamentsTournamentSlugHeadToHeadGetResponse
    expect(() => toHeadToHeadSnapshot(bad)).toThrow(/status/)
  })
})
