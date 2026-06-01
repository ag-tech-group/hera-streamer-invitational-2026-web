import { describe, expect, it } from "vitest"

import { labelSeries } from "@/pages/stats/series-labels"
import type { PlayerSeries } from "@/types"

describe("labelSeries", () => {
  const series: PlayerSeries[] = [
    { profileId: 1, alias: "ladder_alias_1", points: [] },
    { profileId: 2, alias: "ladder_alias_2", points: [] },
  ]

  it("uses the host display-name override when present", () => {
    const labeled = labelSeries(series, new Map([[1, "Day9TV"]]))
    expect(labeled[0].label).toBe("Day9TV")
  })

  it("falls back to the raw alias when there is no override", () => {
    const labeled = labelSeries(series, new Map([[1, "Day9TV"]]))
    expect(labeled[1].label).toBe("ladder_alias_2")
  })

  it("preserves the raw alias alongside the resolved label", () => {
    // The override replaces the *label*, not the alias — analytics and other
    // consumers still need the ladder name (see bio-hint.tsx).
    const labeled = labelSeries(series, new Map([[1, "Day9TV"]]))
    expect(labeled[0].alias).toBe("ladder_alias_1")
  })
})
