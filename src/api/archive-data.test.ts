import { afterEach, describe, expect, it, vi } from "vitest"

import { archiveFileForUrl, fetchArchiveData } from "@/api/archive-data"

// The test build resolves the default tournament, whose `apiTournamentSlug` is
// "kings-gauntlet" — the slug the snapshot files are keyed under.
const SLUG = "kings-gauntlet"

describe("archiveFileForUrl", () => {
  it("maps each consumed read path to its snapshot file", () => {
    expect(archiveFileForUrl(`/v1/tournaments/${SLUG}`)).toBe("tournament.json")
    expect(archiveFileForUrl(`/v1/tournaments/${SLUG}/standings`)).toBe(
      "standings.json"
    )
    expect(archiveFileForUrl(`/v1/tournaments/${SLUG}/teams/standings`)).toBe(
      "teams-standings.json"
    )
    expect(archiveFileForUrl(`/v1/tournaments/${SLUG}/standings/history`)).toBe(
      "standings-history.json"
    )
    expect(archiveFileForUrl(`/v1/tournaments/${SLUG}/civ-stats`)).toBe(
      "civ-stats.json"
    )
    expect(archiveFileForUrl(`/v1/tournaments/${SLUG}/summary`)).toBe(
      "summary.json"
    )
    expect(archiveFileForUrl(`/v1/tournaments/${SLUG}/progression`)).toBe(
      "progression.json"
    )
    expect(archiveFileForUrl("/v1/tournaments")).toBe("tournaments.json")
    expect(archiveFileForUrl("/v1/civilizations")).toBe("civilizations.json")
  })

  it("ignores the query string (head-to-head varies only by ?limit=)", () => {
    expect(
      archiveFileForUrl(`/v1/tournaments/${SLUG}/head-to-head?limit=50`)
    ).toBe("head-to-head.json")
    expect(
      archiveFileForUrl(`/v1/tournaments/${SLUG}/head-to-head?limit=200`)
    ).toBe("head-to-head.json")
  })

  it("treats a leading slash as optional", () => {
    expect(archiveFileForUrl(`v1/tournaments/${SLUG}/standings`)).toBe(
      "standings.json"
    )
  })

  it("returns null for paths the archive does not serve", () => {
    // Short-circuited at their own call sites in archive mode, never snapshotted.
    expect(archiveFileForUrl("/v1/me")).toBeNull()
    expect(archiveFileForUrl("/v1/flags")).toBeNull()
    // Player detail is unused by the public surface, so it isn't captured.
    expect(archiveFileForUrl(`/v1/tournaments/${SLUG}/players/7`)).toBeNull()
    expect(archiveFileForUrl("/v1/leaderboards")).toBeNull()
  })
})

describe("fetchArchiveData", () => {
  afterEach(() => vi.restoreAllMocks())

  it("fetches the snapshot under the base path and returns the orval shape", async () => {
    const body = { items: [{ rank: 1 }] }
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchSpy)

    const result = await fetchArchiveData<{
      data: typeof body
      status: number
    }>(`/v1/tournaments/${SLUG}/standings`)

    // BASE_URL is "/" under test, so the snapshot resolves at the deploy root.
    expect(fetchSpy).toHaveBeenCalledWith("/data/standings.json")
    expect(result.data).toEqual(body)
    expect(result.status).toBe(200)
  })

  it("throws for an unmapped path rather than hitting the network", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    await expect(fetchArchiveData("/v1/me")).rejects.toThrow(/archive mode/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("throws when the snapshot 404s", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not found", { status: 404 }))
    )

    await expect(
      fetchArchiveData(`/v1/tournaments/${SLUG}/standings`)
    ).rejects.toThrow(/404/)
  })
})
