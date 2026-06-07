/**
 * The `/stats` page's in-page navigation registry (#354) — the single source of
 * truth that keeps the desktop table-of-contents rail, the mobile "jump to"
 * select, and the anchor ids on the page itself from drifting apart.
 *
 * Each section's nav label reuses that section's own heading key wherever one
 * already exists (so the rail entry reads identically to the heading it jumps
 * to, and there's almost no new translation); only the "Overview" entry — which
 * targets the headline cards at the very top — needs its own key.
 *
 * Order here is the page's render order, which the scroll-spy relies on to pick
 * the topmost in-view section as "active".
 */
export interface StatsSection {
  /** DOM id of the section's anchor element; also the scroll-spy key. */
  id: string
  /** i18n key for the nav label. */
  labelKey: string
}

/**
 * Named ids so the page can tag each section by meaning (`SECTION_IDS.eloRace`)
 * rather than by a fragile array index. These double as the URL fragments
 * (`/stats#elo-race`), so they're kept short — the `/stats` path already scopes
 * them — and must stay unique among the page's element ids.
 */
export const SECTION_IDS = {
  overview: "overview",
  teamCombined: "team-combined",
  eloRace: "elo-race",
  teamAverage: "team-average",
  eloOverTime: "elo-over-time",
  positions: "positions",
  civilizations: "civilizations",
  civsByTeam: "civs-by-team",
  headToHead: "head-to-head",
} as const

export const STATS_SECTIONS: readonly StatsSection[] = [
  { id: SECTION_IDS.overview, labelKey: "stats.nav.overview" },
  { id: SECTION_IDS.teamCombined, labelKey: "stats.teamEloTitle" },
  { id: SECTION_IDS.eloRace, labelKey: "stats.eloRaceTitle" },
  { id: SECTION_IDS.teamAverage, labelKey: "stats.teamAvgEloTitle" },
  { id: SECTION_IDS.eloOverTime, labelKey: "stats.chartTitle" },
  { id: SECTION_IDS.positions, labelKey: "stats.bumpChartTitle" },
  { id: SECTION_IDS.civilizations, labelKey: "stats.civTitle" },
  { id: SECTION_IDS.civsByTeam, labelKey: "stats.civ.byTeamTitle" },
  { id: SECTION_IDS.headToHead, labelKey: "stats.headToHead.title" },
]

/** All section ids in render order — the scroll-spy's observe set. */
export const STATS_SECTION_IDS: readonly string[] = STATS_SECTIONS.map(
  (s) => s.id
)
