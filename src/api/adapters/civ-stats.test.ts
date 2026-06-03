import { describe, expect, it } from "vitest"

import { toCivStatsSnapshot } from "@/api/adapters/civ-stats"
import type { getCivStatsV1TournamentsTournamentSlugCivStatsGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { CivStats } from "@/api/generated/types"

function responseOf(
  data: CivStats
): getCivStatsV1TournamentsTournamentSlugCivStatsGetResponse {
  return { status: 200, data, headers: new Headers() }
}

describe("toCivStatsSnapshot", () => {
  it("camelCases the overall and per-player counts", () => {
    const snap = toCivStatsSnapshot(
      responseOf({
        last_polled_at: "2026-06-03T00:00:00Z",
        overall: [
          { civilization_id: 27, name: "Magyars", picks: 48, wins: 24 },
        ],
        by_player: [
          {
            tournament_player_id: 12,
            profile_id: 99,
            civs: [{ civilization_id: 27, name: "Magyars", picks: 8, wins: 5 }],
          },
        ],
      })
    )
    expect(snap.lastPolledAt).toBe("2026-06-03T00:00:00Z")
    expect(snap.overall).toEqual([
      { civId: 27, name: "Magyars", picks: 48, wins: 24 },
    ])
    expect(snap.byPlayer).toEqual([
      {
        tournamentPlayerId: 12,
        profileId: 99,
        civs: [{ civId: 27, name: "Magyars", picks: 8, wins: 5 }],
      },
    ])
  })

  it("throws on a non-200 response", () => {
    const bad = {
      status: 422,
      data: { detail: [] },
      headers: new Headers(),
    } as unknown as getCivStatsV1TournamentsTournamentSlugCivStatsGetResponse
    expect(() => toCivStatsSnapshot(bad)).toThrow(/status/)
  })
})
