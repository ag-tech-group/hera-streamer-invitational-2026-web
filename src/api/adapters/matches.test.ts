import { describe, expect, it } from "vitest"

import { toMatchesSnapshot } from "@/api/adapters/matches"
import type { listMatchesV1TournamentsTournamentSlugMatchesGetResponse } from "@/api/generated/hooks/matches/matches"
import type { MatchPlayerRead, MatchRead } from "@/api/generated/types"

function playerDto(overrides: Partial<MatchPlayerRead> = {}): MatchPlayerRead {
  return {
    profile_id: 100,
    civilization_id: 7,
    team_id: 1,
    outcome: "win",
    old_rating: 1500,
    new_rating: 1512,
    xp_gained: 340,
    ...overrides,
  }
}

function matchDto(overrides: Partial<MatchRead> = {}): MatchRead {
  return {
    match_id: 42,
    map_name: "Arabia",
    matchtype_id: 0,
    leaderboard_id: 3,
    started_at: "2026-06-02T10:00:00Z",
    completed_at: "2026-06-02T10:35:00Z",
    description: null,
    state: "completed",
    updated_at: "2026-06-02T10:36:00Z",
    players: [
      playerDto(),
      playerDto({
        profile_id: 200,
        civilization_id: 12,
        outcome: "loss",
        new_rating: 1488,
      }),
    ],
    ...overrides,
  }
}

function responseOf(
  matches: MatchRead[],
  lastPolledAt: string | null = "2026-06-02T10:36:00Z"
): listMatchesV1TournamentsTournamentSlugMatchesGetResponse {
  return {
    status: 200,
    data: { last_polled_at: lastPolledAt, items: matches },
    headers: new Headers(),
  }
}

describe("toMatchesSnapshot", () => {
  it("maps the list envelope and camelCases match fields", () => {
    const snap = toMatchesSnapshot(responseOf([matchDto()]))
    expect(snap.lastPolledAt).toBe("2026-06-02T10:36:00Z")
    expect(snap.matches).toHaveLength(1)
    expect(snap.matches[0]).toMatchObject({
      matchId: 42,
      mapName: "Arabia",
      matchtypeId: 0,
      leaderboardId: 3,
      startedAt: "2026-06-02T10:00:00Z",
      completedAt: "2026-06-02T10:35:00Z",
      state: "completed",
    })
  })

  it("maps each player's civ, outcome, and rating delta", () => {
    const [winner, loser] = toMatchesSnapshot(responseOf([matchDto()]))
      .matches[0].players
    expect(winner).toMatchObject({
      profileId: 100,
      civilizationId: 7,
      teamId: 1,
      outcome: "win",
      oldRating: 1500,
      newRating: 1512,
      xpGained: 340,
    })
    expect(loser).toMatchObject({
      profileId: 200,
      civilizationId: 12,
      outcome: "loss",
      newRating: 1488,
    })
  })

  it("preserves nulls for an in-progress match (no outcome / ratings yet)", () => {
    const inProgress = matchDto({
      state: "in_progress",
      completed_at: null,
      players: [
        playerDto({ outcome: null, old_rating: null, new_rating: null }),
      ],
    })
    const m = toMatchesSnapshot(responseOf([inProgress])).matches[0]
    expect(m.state).toBe("in_progress")
    expect(m.completedAt).toBeNull()
    expect(m.players[0]).toMatchObject({
      outcome: null,
      oldRating: null,
      newRating: null,
    })
  })

  it("returns an empty list (not an error) when there are no matches", () => {
    const snap = toMatchesSnapshot(responseOf([], null))
    expect(snap.matches).toEqual([])
    expect(snap.lastPolledAt).toBeNull()
  })

  it("throws on a non-200 response", () => {
    const bad = {
      status: 422,
      data: { detail: [] },
      headers: new Headers(),
    } as unknown as listMatchesV1TournamentsTournamentSlugMatchesGetResponse
    expect(() => toMatchesSnapshot(bad)).toThrow(/status/)
  })
})
