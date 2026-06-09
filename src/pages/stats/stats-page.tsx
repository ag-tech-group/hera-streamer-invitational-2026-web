import { Flame, Percent, Swords, TrendingUp, Trophy } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { BackToTop } from "@/components/back-to-top"
import { TournamentLayout } from "@/components/tournament-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useCivStats } from "@/hooks/use-civ-stats"
import { useProgression } from "@/hooks/use-progression"
import { useStandings } from "@/hooks/use-standings"
import { useStandingsHistory } from "@/hooks/use-standings-history"
import { useSummary } from "@/hooks/use-summary"
import { useTeamStandings } from "@/hooks/use-team-standings"
import { useTournament } from "@/hooks/use-tournament"
import {
  teamColorMap,
  TEAM_HEX,
  TEAM_COLOR_SLOTS,
  shadeByTeam,
} from "@/lib/team-colors"
import { BumpChart } from "@/pages/stats/bump-chart"
import type { ChartTeam } from "@/pages/stats/chart-legend"
import { toBumpSeries } from "@/pages/stats/bump-series"
import { toCivByTeam } from "@/pages/stats/civ-by-team"
import { CivMeta } from "@/pages/stats/civ-meta"
import { toCivStats } from "@/pages/stats/civ-stats"
import { CivByTeam } from "@/pages/stats/civ-team-board"
import { EloRaceChart } from "@/pages/stats/elo-race-chart"
import { HeadToHeadCard } from "@/pages/stats/head-to-head-card"
import { toPlayerRace, toTeamRace, type EloRace } from "@/pages/stats/elo-race"
import {
  HorizontalBarChart,
  type BarDatum,
} from "@/pages/stats/horizontal-bar-chart"
import { toDepthBars } from "@/pages/stats/team-depth"
import { TeamDepthChart } from "@/pages/stats/team-depth-chart"
import { RatingProgressionChart } from "@/pages/stats/rating-progression-chart"
import { labelSeries } from "@/pages/stats/series-labels"
import { StatsJumpSelect, StatsRail } from "@/pages/stats/stats-nav"
import { SECTION_IDS } from "@/pages/stats/stats-sections"
import { useStatsNav } from "@/pages/stats/use-stats-nav"
import type { StreakLeader, TeamStandingsRow, TournamentSummary } from "@/types"

/**
 * Tournament-wide stats (#164), mounted at `/stats` as the third top-level
 * route alongside `/` and `/teams` (#163). A stack of sections: headline
 * cards, the team combined-elo board (the tournament's scoring metric), the
 * per-player rating-over-time chart, and the peak-rating board. The route is
 * lazy (`stats.lazy.tsx`) so echarts ships in its own chunk.
 *
 * Each board draws from a different endpoint, so a shared `ChartSection`
 * handles each query's loading / empty / error independently rather than
 * gating the whole page on one of them.
 */
export function StatsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t("stats.title"))
  const progression = useProgression()
  const teams = useTeamStandings(true)
  const standings = useStandings()
  const civStats = useCivStats()
  const standingsHistory = useStandingsHistory()
  const summary = useSummary()

  // In-page section nav (#354): the scroll-spy's active section + a jump handler,
  // shared by the desktop rail and the mobile select so they stay in lockstep.
  const { activeId, onJump, clearFragment } = useStatsNav()

  // Hide the team charts until the ladder race starts — pre-start the team
  // ratings are all empty, so the bars would read as noise. Same "started"
  // derivation as `ContextCards`: compare `start_date` against a mount-time
  // instant captured once (keeps `Date.now()` out of the render pass), so a
  // reload re-evaluates it. Null start date counts as not started.
  const tournament = useTournament()
  const [mountedAtMs] = useState(() => Date.now())
  const tournamentStarted = tournament.data?.startDate
    ? new Date(tournament.data.startDate).getTime() <= mountedAtMs
    : false

  const teamAvgData = teams.data ? teamAvgBars(teams.data.rows) : []

  // The /progression series carries only the raw ladder alias, so the chart
  // and the series-derived summary cards would show profile names rather than
  // the host's display override. Join tournamentPlayerId → display name from
  // the standings rows (which do carry it) and feed the labeled series to both
  // — mirroring the Teams view join (#266) and keying on the unified identity
  // (#187) the series itself is keyed on. `tournamentPlayerId` is non-null on
  // every row, so an unlinked entrant's override would join too (a series only
  // ever exists for a linked, rated player, but the key is the same either way).
  const displayNameByTournamentPlayerId = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of standings.data?.rows ?? []) {
      if (row.presentation.displayName) {
        map.set(row.tournamentPlayerId, row.presentation.displayName)
      }
    }
    return map
  }, [standings.data?.rows])
  const labeledSeries = useMemo(
    () =>
      labelSeries(
        progression.data?.series ?? [],
        displayNameByTournamentPlayerId
      ),
    [progression.data?.series, displayNameByTournamentPlayerId]
  )

  // Roster-depth bars decompose each team's combined-peak sum into its members'
  // contributions (#300). Member names aren't on the team payload, so the same
  // display-name map joins them by tournamentPlayerId.
  const depthBars = useMemo(
    () =>
      teams.data
        ? toDepthBars(teams.data.rows, displayNameByTournamentPlayerId)
        : [],
    [teams.data, displayNameByTournamentPlayerId]
  )

  // Civilization pick + win rates (#302), aggregated entrants-only by the API
  // over the whole tournament. Win rate needs a minimum sample so a 1–0 civ
  // can't top the board.
  const civViews = useMemo(
    () => toCivStats(civStats.data?.overall ?? [], MIN_CIV_PICKS),
    [civStats.data?.overall]
  )

  // A `displayName ?? name` label for every entrant, joined by
  // tournamentPlayerId from the standings rows. The /civ-stats payload carries
  // no names, so this labels the "Civs by team" section (#302 follow-up). The
  // /standings/history charts now read labels from that payload's resolved
  // `name` (#243) and only need the roster *membership* set below.
  const labelByTournamentPlayerId = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of standings.data?.rows ?? []) {
      map.set(row.tournamentPlayerId, row.presentation.displayName ?? row.name)
    }
    return map
  }, [standings.data?.rows])

  // Current-roster ids — the #326 phantom guard for the /standings/history
  // charts (bump, elo race): the history endpoint can transiently surface
  // entities that aren't current entrants, and they carry a resolved `name`
  // too, so roster membership (not the label) is what filters them out.
  const rosterIds = useMemo(
    () => new Set(labelByTournamentPlayerId.keys()),
    [labelByTournamentPlayerId]
  )
  const { teamIdByTournamentPlayerId, baseHexByTeamId, slotByTeamId } =
    useMemo(() => {
      const rows = teams.data?.rows ?? []
      const teamIdByPlayer = new Map<number, number>()
      for (const row of rows) {
        for (const member of row.members) {
          teamIdByPlayer.set(member.tournamentPlayerId, row.teamId)
        }
      }
      const slotByTeam = teamColorMap(rows.map((r) => r.teamId))
      const baseHexByTeam = new Map(
        rows.map((r) => [r.teamId, TEAM_HEX[slotByTeam.get(r.teamId) ?? "p1"]])
      )
      return {
        teamIdByTournamentPlayerId: teamIdByPlayer,
        baseHexByTeamId: baseHexByTeam,
        slotByTeamId: slotByTeam,
      }
    }, [teams.data?.rows])
  // Team metadata for the charts' bulk-toggle pills (rating + position): one
  // pill per team, in palette-slot order so the row stays put as ranks shift.
  // Each chart joins its lines to a team via `teamIdByTournamentPlayerId`.
  const chartTeams = useMemo<ChartTeam[]>(() => {
    const slotRank = (teamId: number) =>
      TEAM_COLOR_SLOTS.indexOf(slotByTeamId.get(teamId) ?? TEAM_COLOR_SLOTS[0])
    return [...(teams.data?.rows ?? [])]
      .sort((a, b) => slotRank(a.teamId) - slotRank(b.teamId))
      .map((r) => ({
        teamId: r.teamId,
        name: r.name,
        color: baseHexByTeamId.get(r.teamId) ?? TEAM_HEX[TEAM_COLOR_SLOTS[0]],
      }))
  }, [teams.data?.rows, baseHexByTeamId, slotByTeamId])
  // Per-player team-shaded line colour, computed over the full standings roster
  // ranked by peak — the same hue + per-teammate shade the position chart and
  // the rest of the site use (keyed by tournamentPlayerId). The rating chart
  // looks up each of its lines here instead of an unrelated palette, so a player
  // paints the same colour on every chart. Ranked over the whole roster (an
  // unrated entrant included) so the shading order matches the position chart,
  // which ranks the same way.
  const colorByTournamentPlayerId = useMemo(() => {
    const rankedIds = [...(standings.data?.rows ?? [])]
      .sort((a, b) => (b.maxRating ?? -Infinity) - (a.maxRating ?? -Infinity))
      .map((r) => r.tournamentPlayerId)
    return shadeByTeam(rankedIds, teamIdByTournamentPlayerId, baseHexByTeamId)
  }, [standings.data?.rows, teamIdByTournamentPlayerId, baseHexByTeamId])
  const bump = useMemo(
    () =>
      standingsHistory.data
        ? toBumpSeries(standingsHistory.data, {
            rosterIds,
            teamIdByTournamentPlayerId,
            baseHexByTeamId,
          })
        : { buckets: [], series: [] },
    [
      standingsHistory.data,
      rosterIds,
      teamIdByTournamentPlayerId,
      baseHexByTeamId,
    ]
  )

  // Elo bar-chart race (#301): the standings shuffling over time. Teams race
  // their combined peak elo (the scoring metric, from history.teams[]) and
  // players their peak rating (from history.players[]) — the same
  // /standings/history payload the bump chart consumes, labelled from that
  // payload's resolved names (#243) and coloured by the same team-hue joins
  // built above for the bump chart.
  const teamRace = useMemo<EloRace>(
    () =>
      standingsHistory.data
        ? toTeamRace(standingsHistory.data, {
            teamHexByTeamId: baseHexByTeamId,
          })
        : EMPTY_RACE,
    [standingsHistory.data, baseHexByTeamId]
  )
  const playerRace = useMemo<EloRace>(
    () =>
      standingsHistory.data
        ? toPlayerRace(standingsHistory.data, {
            rosterIds,
            teamIdByTournamentPlayerId,
            baseHexByTeamId,
          })
        : EMPTY_RACE,
    [
      standingsHistory.data,
      rosterIds,
      teamIdByTournamentPlayerId,
      baseHexByTeamId,
    ]
  )

  // Civs by team (#302 follow-up): each team's + member's top picks / win-rate
  // civs, from the API's per-player breakdown joined to the team rosters. Passes
  // the team palette *slot* (not hex) so the cards drive the same
  // `data-team-color` treatment — bloom, stripe, tinted pills — as the Teams tab.
  const civByTeam = useMemo(
    () =>
      civStats.data && teams.data
        ? toCivByTeam(civStats.data.byPlayer, teams.data.rows, {
            labelByTournamentPlayerId,
            slotByTeamId,
            minTeamWinPicks: MIN_TEAM_WIN_PICKS,
          })
        : [],
    [civStats.data, teams.data, labelByTournamentPlayerId, slotByTeamId]
  )

  return (
    <TournamentLayout view="stats">
      {/* Two-column on desktop: the stack of boards on the left, a sticky
          table-of-contents rail on the right; single-column below lg, where the
          rail collapses into the sticky select at the top of the column (#354). */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Mobile/tablet jump control — sticky to the top of the column. */}
          <StatsJumpSelect activeId={activeId} onJump={onJump} />

          {/* "Overview" anchor (the nav's back-to-top target): the headline
              cards, read straight from /summary. */}
          <div id={SECTION_IDS.overview} className="scroll-mt-20">
            {summary.isPending ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : (
              <SummaryCards summary={summary.data ?? null} />
            )}
          </div>

          {/* The combined-peak board (#300): a stacked bar per team whose segments
              are the members' peak contributions, so the bar total is the team's
              combined peak elo (the scoring metric) while its shape shows roster
              balance — one carry vs. even depth. Stays visible but shows its empty
              state until the ladder race starts (#242); pre-start the team ratings
              carry no signal, so the section renders its placeholder rather than
              bars. */}
          <ChartSection
            id={SECTION_IDS.teamCombined}
            title={t("stats.teamEloTitle")}
            query={teams}
            isEmpty={!tournamentStarted || depthBars.length === 0}
            skeletonHeight={260}
          >
            <TeamDepthChart
              bars={depthBars}
              height={Math.max(180, depthBars.length * 56)}
            />
          </ChartSection>

          {/* Elo race (#301) — the animated counterpart to the combined-peak board
              directly above: the same combined peak elo, raced over the tournament
              timeline. Teams by default, players' peak rating via the toggle; both
              from /standings/history. Gated to post-start like the team boards
              (pre-start the elos are flat and equal, so the race would read as
              noise) and needs at least two buckets to animate. */}
          <ChartSection
            id={SECTION_IDS.eloRace}
            title={t("stats.eloRaceTitle")}
            query={standingsHistory}
            isEmpty={
              !tournamentStarted ||
              teamRace.entities.length === 0 ||
              teamRace.buckets.length < 2
            }
            skeletonHeight={360}
          >
            <EloRaceChart teamRace={teamRace} playerRace={playerRace} />
          </ChartSection>

          <ChartSection
            id={SECTION_IDS.teamAverage}
            title={t("stats.teamAvgEloTitle")}
            query={teams}
            isEmpty={!tournamentStarted || teamAvgData.length === 0}
            skeletonHeight={260}
          >
            <HorizontalBarChart
              data={teamAvgData}
              height={Math.max(180, teamAvgData.length * 56)}
            />
          </ChartSection>

          <ChartSection
            id={SECTION_IDS.eloOverTime}
            title={t("stats.chartTitle")}
            query={progression}
            isEmpty={!progression.data || progression.data.series.length === 0}
            skeletonHeight={560}
          >
            {progression.data ? (
              <RatingProgressionChart
                series={labeledSeries}
                teams={chartTeams}
                teamIdByTournamentPlayerId={teamIdByTournamentPlayerId}
                colorByTournamentPlayerId={colorByTournamentPlayerId}
              />
            ) : null}
          </ChartSection>

          {/* Position over time (#299) — the position counterpart to the rating
              chart above. Each entrant's standings position from
              `/standings/history`; the latest bucket equals the live table. */}
          <ChartSection
            id={SECTION_IDS.positions}
            title={t("stats.bumpChartTitle")}
            query={standingsHistory}
            isEmpty={bump.series.length === 0}
            skeletonHeight={520}
          >
            <BumpChart
              buckets={bump.buckets}
              series={bump.series}
              teams={chartTeams}
              teamIdByTournamentPlayerId={teamIdByTournamentPlayerId}
            />
          </ChartSection>

          {/* Civilization pick + win rates, entrants-only from /civ-stats (#302). */}
          <ChartSection
            id={SECTION_IDS.civilizations}
            title={t("stats.civTitle")}
            query={civStats}
            isEmpty={civViews.byPicks.length === 0}
            skeletonHeight={360}
          >
            <CivMeta stats={civViews} />
          </ChartSection>

          {/* Civs by team (#302 follow-up): each team's + member's favourite and
              best-performing civs, from the API's per-player breakdown. */}
          <ChartSection
            id={SECTION_IDS.civsByTeam}
            title={t("stats.civ.byTeamTitle")}
            query={civStats}
            isEmpty={civByTeam.every((g) => g.players.length === 0)}
            skeletonHeight={320}
          >
            <CivByTeam groups={civByTeam} />
          </ChartSection>

          {/* Head-to-head feed (#349): the tournament's streamer-vs-streamer games,
              newest first. Sits at the foot of the stack as a human-interest feed
              after the analytical charts; owns its own query + states, and shows a
              friendly empty state until the first clash lands. */}
          <HeadToHeadCard id={SECTION_IDS.headToHead} />
        </div>

        {/* Table-of-contents rail (right column on desktop); hidden below lg,
            where the sticky select at the top of the column takes over (#354). */}
        <StatsRail activeId={activeId} onJump={onJump} />
      </div>

      <BackToTop onActivate={clearFragment} />
    </TournamentLayout>
  )
}

/** Stable empty race for the loading/no-data passes (keeps memo deps steady). */
const EMPTY_RACE: EloRace = { buckets: [], entities: [] }

/** A civ needs at least this many games before its win rate is shown (#302). */
const MIN_CIV_PICKS = 5

// A team's civ needs at least this many roster-wide picks before its win rate
// can headline the by-team win column (so a 1–0 civ can't). Tunable.
const MIN_TEAM_WIN_PICKS = 4

/**
 * Teams by combined **peak** elo average (#242, peak-based since API #158). The
 * Teams tab headline switched from average to sum (sum is what teams are ranked
 * by), so this chart keeps the average visible somewhere — useful for comparing
 * teams of different sizes, where the sum favours the larger roster.
 */
function teamAvgBars(rows: TeamStandingsRow[]): BarDatum[] {
  const colorByTeamId = teamColorMap(rows.map((r) => r.teamId))
  return rows.map((r) => ({
    label: r.name,
    value: Math.round(r.combinedRatingAverage),
    color: TEAM_HEX[colorByTeamId.get(r.teamId) ?? "p1"],
  }))
}

/**
 * A titled card frame around one chart, mirroring the standings `TableShell`
 * chrome (brand accent stripe over the card surface). Owns the section's
 * loading / empty / error states so each board resolves on its own.
 */
function ChartSection({
  id,
  title,
  query,
  isEmpty,
  skeletonHeight,
  children,
}: {
  id?: string
  title: string
  query: { isPending: boolean; isError: boolean; refetch: () => void }
  isEmpty: boolean
  skeletonHeight: number
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section
      id={id}
      className="bg-card shadow-card relative scroll-mt-20 overflow-hidden rounded-lg p-4 pt-5"
    >
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <h2 className="text-muted-foreground font-display mb-3 px-1 text-sm tracking-widest uppercase">
        {title}
      </h2>
      {query.isPending ? (
        <Skeleton className="rounded-md" style={{ height: skeletonHeight }} />
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-destructive text-sm">{t("stats.error")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
          >
            {t("stats.retry")}
          </Button>
        </div>
      ) : isEmpty ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t("stats.noData")}
        </p>
      ) : (
        children
      )}
    </section>
  )
}

/**
 * Formats a streak's date range for the longest-win-streak card's "when did
 * this happen" tooltip (#243) — e.g. `Jun 3 – Jun 4`. Returns `undefined` when
 * either endpoint is missing (a win that settled without a completion time), so
 * the card simply gets no tooltip. Dates render in the active UI language.
 */
function streakRange(
  card: StreakLeader | null,
  lang: string
): string | undefined {
  if (!card?.streakStart || !card.streakEnd) return undefined
  const fmt = new Intl.DateTimeFormat(lang, { month: "short", day: "numeric" })
  return `${fmt.format(new Date(card.streakStart))} – ${fmt.format(
    new Date(card.streakEnd)
  )}`
}

/**
 * The five headline cards, read straight from the API's `/summary` endpoint
 * (#243): the server selects each leader, tie-breaks deterministically, applies
 * the win-rate minimum-games guard, and resolves each `name` to the display
 * label — so the page just renders. A `null` card (no qualifying entrant in
 * that metric) shows an em dash.
 */
function SummaryCards({ summary }: { summary: TournamentSummary | null }) {
  const { t, i18n } = useTranslation()
  // The climber value carries a sign (someone may be the "least dropped");
  // peak, streak, and matches are plain counts.
  const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
  return (
    // Highest peak leads — it's the tournament's headline metric (only peak
    // elos count toward seeding). The two win-quality stats (win rate, longest
    // streak) sit beside it, then the movement / volume stats. Five cards: the
    // grid steps 2 → 3 → 5 so it never orphans the 5th alone on a second row.
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        icon={Trophy}
        label={t("stats.cards.highestPeak")}
        value={
          summary?.highestPeakRating
            ? String(summary.highestPeakRating.value)
            : "—"
        }
        player={summary?.highestPeakRating?.name ?? null}
      />
      <StatCard
        icon={Percent}
        label={t("stats.cards.winPct")}
        value={
          summary?.bestWinRate
            ? `${summary.bestWinRate.value.toFixed(1)}%`
            : "—"
        }
        player={summary?.bestWinRate?.name ?? null}
      />
      <StatCard
        icon={Flame}
        label={t("stats.cards.longestWinStreak")}
        value={
          summary?.longestWinStreak
            ? String(summary.longestWinStreak.value)
            : "—"
        }
        player={summary?.longestWinStreak?.name ?? null}
        tooltip={streakRange(summary?.longestWinStreak ?? null, i18n.language)}
      />
      <StatCard
        icon={TrendingUp}
        label={t("stats.cards.biggestClimber")}
        value={
          summary?.biggestClimber ? signed(summary.biggestClimber.value) : "—"
        }
        player={summary?.biggestClimber?.name ?? null}
      />
      <StatCard
        icon={Swords}
        label={t("stats.cards.mostMatches")}
        value={
          summary?.mostGamesPlayed ? String(summary.mostGamesPlayed.value) : "—"
        }
        player={summary?.mostGamesPlayed?.name ?? null}
      />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  player,
  tooltip,
}: {
  icon: LucideIcon
  label: string
  value: string
  player: string | null
  tooltip?: string
}) {
  return (
    <div
      title={tooltip}
      className="bg-card shadow-card relative flex items-center gap-3.5 overflow-hidden rounded-lg border p-4"
    >
      {/* Brand accent rail down the left edge — mirrors the chart frame's top
          stripe so the cards read as part of the same furniture. */}
      <span
        aria-hidden
        className="bg-brand absolute inset-y-0 start-0 w-[3px]"
      />
      <span className="bg-brand/10 text-brand flex size-11 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
          {label}
        </p>
        <p className="font-display text-2xl leading-none tracking-wide tabular-nums">
          {value}
        </p>
        {player ? (
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {player}
          </p>
        ) : null}
      </div>
    </div>
  )
}
