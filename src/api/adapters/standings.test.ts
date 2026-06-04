import { describe, expect, it } from "vitest"

import { toStandingsSnapshot } from "@/api/adapters/standings"
import type { getStandingsV1TournamentsTournamentSlugStandingsGetResponse } from "@/api/generated/hooks/tournaments/tournaments"
import type { StandingRow } from "@/api/generated/types"

/** A `StandingRow` DTO whose lifetime fields deliberately differ from its
 *  tournament_record, so a mapping that reads the wrong scope is obvious. */
function dto(overrides: Partial<StandingRow> = {}): StandingRow {
  return {
    tournament_player_id: 1,
    profile_id: 1,
    name: "Player",
    alias: "Player",
    country: "us",
    team: null,
    presentation: {},
    // Lifetime fields — should NOT feed the stat columns (#238).
    current_rating: 2150,
    max_rating: 2400,
    wins: 999,
    losses: 100,
    streak: 50,
    recent_results: ["win", "win", "win"],
    rank: 1,
    rank_total: 2,
    in_match: false,
    live_match_id: null,
    stream_live: false,
    stream_title: null,
    stream_category: null,
    last_match_at: "2020-01-01T00:00:00Z",
    updated_at: "2026-05-30T00:00:00Z",
    games: 8,
    win_pct: 90.0,
    // Tournament-window record — the source the stat columns should read.
    tournament_record: {
      games_played: 8,
      wins: 6,
      losses: 2,
      streak: 3,
      longest_win_streak: 5,
      peak_rating: 2180,
      last_match_at: "2026-05-30T12:00:00Z",
      recent_results: ["win", "loss", "win"],
      recent_matchups: [],
      win_pct: 75.0,
    },
    ...overrides,
  }
}

function snapshotOf(row: StandingRow) {
  const response: getStandingsV1TournamentsTournamentSlugStandingsGetResponse =
    {
      status: 200,
      data: { last_polled_at: "2026-05-30T00:00:00Z", items: [row] },
      headers: new Headers(),
    }
  return toStandingsSnapshot(response).rows[0]
}

describe("toStandingsSnapshot — tournament-window stat sourcing (#238)", () => {
  it("reads streak / recent / win% / activity from tournament_record, not lifetime", () => {
    const row = snapshotOf(dto())
    expect(row.streak).toBe(3) // tournament_record.streak (current), not 50
    // longest_win_streak (#331) is the in-window *peak* run, distinct from the
    // *current* streak above (3) and the lifetime streak (50).
    expect(row.longestWinStreak).toBe(5)
    expect(row.recentResults).toEqual(["win", "loss", "win"]) // not the lifetime trio
    expect(row.winPct).toBe(75.0) // tournament_record.win_pct, not 90
    expect(row.wins).toBe(6) // tournament_record.wins, not 999
    expect(row.losses).toBe(2) // tournament_record.losses, not 100
    expect(row.lastMatchAt).toBe("2026-05-30T12:00:00Z") // not the 2020 lifetime
    expect(row.gamesPlayed).toBe(8)
  })

  it("keeps Rating on the lifetime live ladder current_rating", () => {
    // Organizer decision (#238): Rating should move as the player competes, so
    // it stays the lifetime live rating rather than a tournament-scoped value.
    expect(snapshotOf(dto()).currentRating).toBe(2150)
  })

  it("reads Peak from the lifetime max_rating, not the in-window peak (#246)", () => {
    // Walked back from #238: Peak is the all-time ladder peak (2400), not the
    // tournament_record.peak_rating (2180).
    expect(snapshotOf(dto()).maxRating).toBe(2400)
  })

  it("surfaces the empty state for a member with zero in-window games", () => {
    const row = snapshotOf(
      dto({
        // No in-window games → the tournament-scoped fields are empty…
        tournament_record: {
          games_played: 0,
          wins: 0,
          losses: 0,
          streak: 0,
          longest_win_streak: 0,
          peak_rating: null,
          last_match_at: null,
          recent_results: [],
          recent_matchups: [],
          win_pct: null,
        },
        // …but the lifetime peak is still present (a player can have a career
        // peak before playing any tournament match).
        max_rating: 2400,
      })
    )
    // Tournament-scoped stats read empty (→ "—" in the table)…
    expect(row.winPct).toBeNull()
    expect(row.lastMatchAt).toBeNull()
    expect(row.recentResults).toEqual([])
    expect(row.streak).toBe(0)
    expect(row.longestWinStreak).toBe(0) // no in-window wins → 0; the card skips this row
    // …but Peak (lifetime, #246) and the live ladder rating still show.
    expect(row.maxRating).toBe(2400)
    expect(row.currentRating).toBe(2150)
  })

  it("renders Peak as null only for a brand-new account (null max_rating)", () => {
    expect(snapshotOf(dto({ max_rating: null })).maxRating).toBeNull()
  })
})

describe("toStandingsSnapshot — defensive name coercion (#313)", () => {
  // A stale API revision served mid-rollover can omit `name` even though the
  // generated DTO marks it required. The adapter must still yield a string so
  // the standings sort (`comparePeakRank` → `name.localeCompare`) can't throw
  // and take down the whole table. `undefined as unknown as string` simulates
  // that contract-violating response.
  it("coerces a missing name to the alias so the sort comparator can't crash", () => {
    const row = snapshotOf(dto({ name: undefined as unknown as string }))
    expect(typeof row.name).toBe("string")
    expect(row.name).toBe("Player") // falls back to the ladder handle (alias)
  })

  it("falls back to an empty string when both name and alias are missing", () => {
    const row = snapshotOf(
      dto({
        name: undefined as unknown as string,
        alias: undefined as unknown as string,
      })
    )
    expect(row.name).toBe("")
  })
})
