import type { PlayerSeries } from "@/types"

/** A progression series plus its resolved on-screen label. */
export type LabeledSeries = PlayerSeries & {
  /** The name to display: the host's display-name override, else the raw alias. */
  label: string
}

/**
 * Joins the host `presentation.displayName` override onto each progression
 * series by `profileId`.
 *
 * The `/progression` payload carries only the raw ladder `alias` (no
 * `presentation`), so the `/stats` charts and cards would otherwise show
 * profile names instead of the display names viewers see everywhere else. The
 * override lives on the standings rows, so `StatsPage` builds a
 * `profileId → displayName` map from them and we resolve each label here —
 * mirroring the Teams view join (#266). The raw `alias` is preserved so callers
 * that need the ladder name (e.g. analytics) still have it.
 */
export function labelSeries(
  series: PlayerSeries[],
  displayNameByProfileId: Map<number, string>
): LabeledSeries[] {
  return series.map((s) => ({
    ...s,
    label: displayNameByProfileId.get(s.profileId) ?? s.alias,
  }))
}
