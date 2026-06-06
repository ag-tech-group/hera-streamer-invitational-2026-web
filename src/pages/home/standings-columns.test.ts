import { describe, expect, it } from "vitest"

import {
  defaultDirectionFor,
  metricForSort,
  SORTABLE_COLUMNS,
} from "@/pages/home/standings-columns"

describe("standings columns config", () => {
  it("lists every sortable field for the mobile bar, mirroring the desktop header", () => {
    expect(SORTABLE_COLUMNS.map((c) => c.key)).toEqual([
      "team",
      "alias",
      "maxRating",
      "currentRating",
      "gamesPlayed",
      "winPct",
      "streak",
      "lastMatchAt",
      "watch",
    ])
  })

  it("declares each column's natural starting direction", () => {
    // String-ish columns start ascending, magnitude columns descending.
    expect(defaultDirectionFor("team")).toBe("asc")
    expect(defaultDirectionFor("alias")).toBe("asc")
    expect(defaultDirectionFor("maxRating")).toBe("desc")
    expect(defaultDirectionFor("winPct")).toBe("desc")
    // Unknown keys fall back to descending rather than throwing.
    expect(defaultDirectionFor("nope")).toBe("desc")
  })
})

describe("metricForSort", () => {
  it("defaults the collapsed metric to Peak when nothing is sorted", () => {
    expect(metricForSort(null).key).toBe("maxRating")
  })

  it("shows Peak instead of echoing the name when sorted by player", () => {
    expect(metricForSort({ key: "alias", direction: "asc" }).key).toBe(
      "maxRating"
    )
  })

  it("mirrors the active sort field for every other column", () => {
    expect(metricForSort({ key: "winPct", direction: "desc" }).key).toBe(
      "winPct"
    )
    expect(metricForSort({ key: "streak", direction: "desc" }).key).toBe(
      "streak"
    )
    expect(metricForSort({ key: "watch", direction: "desc" }).key).toBe("watch")
  })

  it("falls back to Peak for an unknown sort key", () => {
    expect(metricForSort({ key: "mystery", direction: "asc" }).key).toBe(
      "maxRating"
    )
  })
})
