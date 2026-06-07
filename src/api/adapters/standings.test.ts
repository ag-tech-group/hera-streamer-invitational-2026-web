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
      // recent_matchups (#339, #349) is the civ-matchup form the frontend reads.
      // 1st: a normal 1v1 with both civs + a named regular ladder opponent (not a
      // streamer); 2nd: a null opponent civ AND null opponent name (the graceful
      // fallback case). Map names carry the replay extension on purpose.
      recent_matchups: [
        {
          outcome: "win",
          civilization_id: 17,
          civilization_name: "Franks",
          opponent_civilization_id: 21,
          opponent_civilization_name: "Mayans",
          opponent_profile_id: 555,
          opponent_name: "LadderFoe",
          opponent_tournament_player_id: null,
          map_name: "Arabia.rms",
          completed_at: "2026-05-30T12:00:00Z",
        },
        {
          outcome: "loss",
          civilization_id: 11,
          civilization_name: "Goths",
          opponent_civilization_id: null,
          opponent_civilization_name: null,
          opponent_profile_id: null,
          opponent_name: null,
          opponent_tournament_player_id: null,
          map_name: "Arena.rms2",
          completed_at: "2026-05-30T11:00:00Z",
        },
      ],
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
    // recent_matchups (#339) is sourced from tournament_record — there's no
    // lifetime counterpart, so this just proves the in-window form is mapped.
    expect(row.recentMatchups.map((m) => m.outcome)).toEqual(["win", "loss"])
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
    expect(row.recentMatchups).toEqual([])
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

describe("toStandingsSnapshot — recent matchups (#339)", () => {
  /** Overrides only `recent_matchups` on the default fixture's record. */
  function withMatchups(
    matchups: StandingRow["tournament_record"]["recent_matchups"]
  ): StandingRow {
    return dto({
      tournament_record: {
        ...dto().tournament_record,
        recent_matchups: matchups,
      },
    })
  }

  it("maps each matchup with its civ names and resolves emblems by name", () => {
    const row = snapshotOf(dto())
    expect(row.recentMatchups).toHaveLength(2)
    const [first] = row.recentMatchups
    expect(first).toMatchObject({
      outcome: "win",
      civName: "Franks",
      opponentCivName: "Mayans",
    })
    // Emblems resolve through the same `civEmblemUrl` the civ board uses — a
    // non-null URL whose basename is the lowercased civ name.
    expect(first.civEmblemUrl).toMatch(/franks\.webp$/)
    expect(first.opponentCivEmblemUrl).toMatch(/mayans\.webp$/)
  })

  it("cleans the replay map name (strips the .rms / .rms2 extension)", () => {
    const [first, second] = snapshotOf(dto()).recentMatchups
    expect(first.mapName).toBe("Arabia")
    expect(second.mapName).toBe("Arena")
  })

  it("handles a null opponent civ (non-1v1 or unnamed) gracefully", () => {
    // The default fixture's 2nd matchup carries a null opponent civ.
    const second = snapshotOf(dto()).recentMatchups[1]
    expect(second.opponentCivName).toBeNull()
    expect(second.opponentCivEmblemUrl).toBeNull()
    // The player's own civ still resolves independently.
    expect(second.civName).toBe("Goths")
    expect(second.civEmblemUrl).toMatch(/goths\.webp$/)
  })

  it("yields a null emblem (but keeps the name) when the player civ is unnamed", () => {
    const m = snapshotOf(
      withMatchups([
        {
          outcome: "win",
          civilization_id: 999,
          civilization_name: null, // API couldn't name it
          opponent_civilization_id: 1,
          opponent_civilization_name: "Aztecs",
          opponent_profile_id: 555,
          opponent_name: "Aztecs main",
          opponent_tournament_player_id: null,
          map_name: "Hideout.rms",
          completed_at: null,
        },
      ])
    ).recentMatchups[0]
    expect(m.civName).toBeNull()
    expect(m.civEmblemUrl).toBeNull()
    // The opponent still resolves on its own.
    expect(m.opponentCivName).toBe("Aztecs")
    expect(m.opponentCivEmblemUrl).toMatch(/aztecs\.webp$/)
    expect(m.completedAt).toBeNull()
  })

  it("yields a null emblem for a named civ we have no committed shield for", () => {
    const m = snapshotOf(
      withMatchups([
        {
          outcome: "loss",
          civilization_id: 12345,
          civilization_name: "Atlanteans", // not in our emblem set
          opponent_civilization_id: 1,
          opponent_civilization_name: "Aztecs",
          opponent_profile_id: 555,
          opponent_name: "Aztecs main",
          opponent_tournament_player_id: null,
          map_name: "Nomad.rms",
          completed_at: "2026-06-01T00:00:00Z",
        },
      ])
    ).recentMatchups[0]
    expect(m.civName).toBe("Atlanteans") // name still shown…
    expect(m.civEmblemUrl).toBeNull() // …but no emblem to render
  })
})

describe("toStandingsSnapshot — recent matchup opponents (#349)", () => {
  /** Builds the full snapshot rows from several DTO rows — needed for the
   *  cross-row resolution of a fellow streamer's profile URL. */
  function rowsOf(...items: StandingRow[]) {
    const response: getStandingsV1TournamentsTournamentSlugStandingsGetResponse =
      {
        status: 200,
        data: { last_polled_at: "2026-05-30T00:00:00Z", items },
        headers: new Headers(),
      }
    return toStandingsSnapshot(response).rows
  }

  /** A recent-matchup DTO carrying the #349 opponent fields, defaulted to a
   *  regular (non-streamer) ladder opponent. */
  function matchupDto(
    overrides: Partial<
      StandingRow["tournament_record"]["recent_matchups"][number]
    > = {}
  ): StandingRow["tournament_record"]["recent_matchups"][number] {
    return {
      outcome: "win",
      civilization_id: 17,
      civilization_name: "Franks",
      opponent_civilization_id: 21,
      opponent_civilization_name: "Mayans",
      opponent_profile_id: 555,
      opponent_name: "LadderFoe",
      opponent_tournament_player_id: null,
      map_name: "Arabia.rms",
      completed_at: "2026-05-30T12:00:00Z",
      ...overrides,
    }
  }

  /** Replaces a row's recent matchups with a single given matchup. */
  function withMatchup(
    row: StandingRow,
    m: StandingRow["tournament_record"]["recent_matchups"][number]
  ): StandingRow {
    return {
      ...row,
      tournament_record: { ...row.tournament_record, recent_matchups: [m] },
    }
  }

  it("shows the opponent name and marks a regular ladder opponent as not a streamer", () => {
    // The default fixture's 1st matchup is a named, non-streamer opponent.
    const m = rowsOf(dto())[0].recentMatchups[0]
    expect(m.opponentName).toBe("LadderFoe")
    expect(m.opponentIsStreamer).toBe(false)
    expect(m.opponentProfileUrl).toBeNull()
  })

  it("marks a fellow streamer and links to that streamer's own row profile URL", () => {
    const viewer = withMatchup(
      dto({ tournament_player_id: 1, profile_id: 1 }),
      matchupDto({ opponent_name: "Hera", opponent_tournament_player_id: 2 })
    )
    const opponent = dto({
      tournament_player_id: 2,
      profile_id: 2,
      // The link is resolved from the OPPONENT's row presentation, not the matchup.
      presentation: { profileUrl: "https://www.aoe2insights.com/user/777/" },
    })
    const m = rowsOf(viewer, opponent)[0].recentMatchups[0]
    expect(m.opponentIsStreamer).toBe(true)
    expect(m.opponentName).toBe("Hera")
    expect(m.opponentProfileUrl).toBe("https://www.aoe2insights.com/user/777/")
  })

  it("highlights a fellow streamer with no profile URL but gives no link", () => {
    const viewer = withMatchup(
      dto({ tournament_player_id: 1, profile_id: 1 }),
      matchupDto({ opponent_name: "Hera", opponent_tournament_player_id: 2 })
    )
    const opponent = dto({
      tournament_player_id: 2,
      profile_id: 2,
      presentation: {},
    })
    const m = rowsOf(viewer, opponent)[0].recentMatchups[0]
    expect(m.opponentIsStreamer).toBe(true)
    expect(m.opponentProfileUrl).toBeNull()
  })

  it("leaves the link null when the fellow streamer isn't in this snapshot", () => {
    const viewer = withMatchup(
      dto({ tournament_player_id: 1, profile_id: 1 }),
      matchupDto({ opponent_name: "Ghost", opponent_tournament_player_id: 999 })
    )
    const m = rowsOf(viewer)[0].recentMatchups[0]
    expect(m.opponentIsStreamer).toBe(true)
    expect(m.opponentProfileUrl).toBeNull()
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

describe("toStandingsSnapshot — live stream fields (#328)", () => {
  it("maps stream title and category through for a live row", () => {
    const row = snapshotOf(
      dto({
        stream_live: true,
        stream_title: "🔴 RANKED 1v1 TO 2.5K",
        stream_category: "Age of Empires II",
      })
    )
    expect(row.streamLive).toBe(true)
    expect(row.streamTitle).toBe("🔴 RANKED 1v1 TO 2.5K")
    expect(row.streamCategory).toBe("Age of Empires II")
  })

  it("passes null title/category through for an offline row", () => {
    const row = snapshotOf(dto())
    expect(row.streamLive).toBe(false)
    expect(row.streamTitle).toBeNull()
    expect(row.streamCategory).toBeNull()
  })
})
