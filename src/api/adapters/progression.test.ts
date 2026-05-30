import { describe, expect, it } from "vitest"

import { toProgressionSnapshot } from "@/api/adapters/progression"
import type { getProgressionV1TournamentsTournamentSlugProgressionGetResponse } from "@/api/generated/hooks/tournaments/tournaments"

describe("toProgressionSnapshot", () => {
  it("unwraps the envelope and camelCases each player's rating series", () => {
    const response: getProgressionV1TournamentsTournamentSlugProgressionGetResponse =
      {
        status: 200,
        data: {
          last_polled_at: "2026-05-30T00:00:00Z",
          items: [
            {
              profile_id: 1,
              alias: "Alpha",
              points: [
                { completed_at: "2026-05-01T00:00:00Z", rating: 2000 },
                { completed_at: "2026-05-02T00:00:00Z", rating: 2025 },
              ],
            },
          ],
        },
        headers: new Headers(),
      }

    const snapshot = toProgressionSnapshot(response)

    expect(snapshot.lastPolledAt).toBe("2026-05-30T00:00:00Z")
    expect(snapshot.series).toEqual([
      {
        profileId: 1,
        alias: "Alpha",
        points: [
          { completedAt: "2026-05-01T00:00:00Z", rating: 2000 },
          { completedAt: "2026-05-02T00:00:00Z", rating: 2025 },
        ],
      },
    ])
  })

  it("throws on a non-200 response (ky would have thrown first in practice)", () => {
    const response: getProgressionV1TournamentsTournamentSlugProgressionGetResponse =
      {
        status: 422,
        data: { detail: [] },
        headers: new Headers(),
      }

    expect(() => toProgressionSnapshot(response)).toThrow()
  })
})
