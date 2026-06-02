import { lightenHex, TEAM_HEX, teamColorMap } from "@/lib/team-colors"
import type { TeamMember, TeamStandingsRow } from "@/types"

/** One segment of a team's stacked bar — a single member's peak contribution. */
export interface DepthSegment {
  /** Tooltip label: the member's resolved display name (override → alias → —). */
  label: string
  /** The member's peak rating — the segment's width. */
  value: number
  /** Fill colour: the team hue, lightened per member so segments stay distinct. */
  color: string
}

/** One stacked bar — a team, its member segments, and the bar's total. */
export interface DepthBar {
  teamId: number
  /** Category label: the team name. */
  label: string
  /**
   * Sum of the segment values — equal to the combined-sum board's
   * `combinedRatingSum` by construction (both sum the same non-null peaks), so
   * the two team boards always show identical totals.
   */
  total: number
  /** Members with a recorded peak, largest contribution first. */
  segments: DepthSegment[]
}

/**
 * How far the smallest contributor's segment is lightened from the base team
 * hue. Members are spread evenly across `[0, MAX_LIGHTEN]`, so the top scorer
 * is the full hue and the rest fan out lighter — enough separation to read the
 * roster split without any segment washing into the card.
 */
const MAX_LIGHTEN = 0.5

/** A team member narrowed to those with a recorded peak. */
type RatedMember = TeamMember & { peakRating: number }

/**
 * Builds the team-depth stacked bars (#300): one bar per team, each segment a
 * member's peak-rating contribution, shaded within the team's hue.
 *
 * Only members with a recorded peak are included — exactly the set the
 * combined-sum board sums (API #158) — so each bar's `total` equals that team's
 * `combinedRatingSum` and the stacked board never disagrees with the flat one.
 * Segments are ordered largest-first so the biggest carry anchors the bar.
 *
 * Member names aren't on the team-standings payload, so the host display-name
 * override is joined from the players standings by `tournamentPlayerId` — the
 * same map and fallback chain (override → alias → —) the Teams view uses (#281),
 * keyed on the unified identity (#187).
 */
export function toDepthBars(
  rows: TeamStandingsRow[],
  displayNameByTournamentPlayerId: Map<number, string>
): DepthBar[] {
  // Colour by team identity (creation order, #231) from the full id set, so a
  // team's bar matches its panel on the Teams tab regardless of rank order.
  const colorByTeamId = teamColorMap(rows.map((r) => r.teamId))
  return rows.map((row) => {
    const base = TEAM_HEX[colorByTeamId.get(row.teamId) ?? "p1"]
    const rated = row.members
      .filter((m): m is RatedMember => m.peakRating !== null)
      .sort((a, b) => b.peakRating - a.peakRating)
    const segments = rated.map((member, i) => ({
      label:
        displayNameByTournamentPlayerId.get(member.tournamentPlayerId) ??
        member.alias ??
        "—",
      value: member.peakRating,
      // Even split of the lighten range across the roster; a lone member keeps
      // the full hue (no divide-by-zero on a single-segment bar).
      color:
        rated.length > 1
          ? lightenHex(base, (i / (rated.length - 1)) * MAX_LIGHTEN)
          : base,
    }))
    const total = segments.reduce((sum, seg) => sum + seg.value, 0)
    return { teamId: row.teamId, label: row.name, total, segments }
  })
}
