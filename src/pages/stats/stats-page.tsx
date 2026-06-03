import { Flame, Percent, Swords, TrendingUp, Trophy } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { TournamentLayout } from "@/components/tournament-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useCivStats } from "@/hooks/use-civ-stats"
import { useProgression } from "@/hooks/use-progression"
import { useStandings } from "@/hooks/use-standings"
import { useStandingsHistory } from "@/hooks/use-standings-history"
import { useTeamStandings } from "@/hooks/use-team-standings"
import { useTournament } from "@/hooks/use-tournament"
import { teamColorMap, TEAM_HEX } from "@/lib/team-colors"
import { BumpChart } from "@/pages/stats/bump-chart"
import { toBumpSeries } from "@/pages/stats/bump-series"
import { toCivByTeam } from "@/pages/stats/civ-by-team"
import { CivMeta } from "@/pages/stats/civ-meta"
import { toCivStats } from "@/pages/stats/civ-stats"
import { CivByTeam } from "@/pages/stats/civ-team-board"
import { EloRaceChart } from "@/pages/stats/elo-race-chart"
import { toPlayerRace, toTeamRace, type EloRace } from "@/pages/stats/elo-race"
import {
  HorizontalBarChart,
  type BarDatum,
} from "@/pages/stats/horizontal-bar-chart"
import { toDepthBars } from "@/pages/stats/team-depth"
import { TeamDepthChart } from "@/pages/stats/team-depth-chart"
import { RatingProgressionChart } from "@/pages/stats/rating-progression-chart"
import { labelSeries, type LabeledSeries } from "@/pages/stats/series-labels"
import type { StandingsRow, TeamStandingsRow } from "@/types"

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

  // A full `displayName ?? name` label for every entrant — the
  // /standings/history, elo-race, and /civ-stats payloads carry no names, so
  // join them by tournamentPlayerId from the standings rows. Feeds the position
  // bump chart (#299) and the "Civs by team" section (#302 follow-up).
  const labelByTournamentPlayerId = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of standings.data?.rows ?? []) {
      map.set(row.tournamentPlayerId, row.presentation.displayName ?? row.name)
    }
    return map
  }, [standings.data?.rows])
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
  const bump = useMemo(
    () =>
      standingsHistory.data
        ? toBumpSeries(standingsHistory.data, {
            labelByTournamentPlayerId,
            teamIdByTournamentPlayerId,
            baseHexByTeamId,
          })
        : { buckets: [], series: [] },
    [
      standingsHistory.data,
      labelByTournamentPlayerId,
      teamIdByTournamentPlayerId,
      baseHexByTeamId,
    ]
  )

  // Elo bar-chart race (#301): the standings shuffling over time. Teams race
  // their combined peak elo (the scoring metric, from history.teams[]) and
  // players their peak rating (from history.players[]) — the same
  // /standings/history payload the bump chart consumes, reusing the same colour
  // and display-name joins. The team bars need a teamId → name map; the rest of
  // the joins (label, teamId, base hue) are already built above for the bump
  // chart.
  const teamNameByTeamId = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of teams.data?.rows ?? []) map.set(row.teamId, row.name)
    return map
  }, [teams.data?.rows])
  const teamRace = useMemo<EloRace>(
    () =>
      standingsHistory.data
        ? toTeamRace(standingsHistory.data, {
            teamNameByTeamId,
            teamHexByTeamId: baseHexByTeamId,
          })
        : EMPTY_RACE,
    [standingsHistory.data, teamNameByTeamId, baseHexByTeamId]
  )
  const playerRace = useMemo<EloRace>(
    () =>
      standingsHistory.data
        ? toPlayerRace(standingsHistory.data, {
            labelByTournamentPlayerId,
            teamIdByTournamentPlayerId,
            baseHexByTeamId,
          })
        : EMPTY_RACE,
    [
      standingsHistory.data,
      labelByTournamentPlayerId,
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
      {progression.isPending || standings.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <SummaryCards
          series={labeledSeries}
          standingsRows={standings.data?.rows ?? []}
        />
      )}

      {/* The combined-peak board (#300): a stacked bar per team whose segments
          are the members' peak contributions, so the bar total is the team's
          combined peak elo (the scoring metric) while its shape shows roster
          balance — one carry vs. even depth. Stays visible but shows its empty
          state until the ladder race starts (#242); pre-start the team ratings
          carry no signal, so the section renders its placeholder rather than
          bars. */}
      <ChartSection
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
        title={t("stats.chartTitle")}
        query={progression}
        isEmpty={!progression.data || progression.data.series.length === 0}
        skeletonHeight={560}
      >
        {progression.data ? (
          <RatingProgressionChart series={labeledSeries} />
        ) : null}
      </ChartSection>

      {/* Position over time (#299) — the position counterpart to the rating
          chart above. Each entrant's standings position from
          `/standings/history`; the latest bucket equals the live table. */}
      <ChartSection
        title={t("stats.bumpChartTitle")}
        query={standingsHistory}
        isEmpty={bump.series.length === 0}
        skeletonHeight={520}
      >
        <BumpChart buckets={bump.buckets} series={bump.series} />
      </ChartSection>

      {/* Civilization pick + win rates, entrants-only from /civ-stats (#302). */}
      <ChartSection
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
        title={t("stats.civ.byTeamTitle")}
        query={civStats}
        isEmpty={civByTeam.every((g) => g.players.length === 0)}
        skeletonHeight={320}
      >
        <CivByTeam groups={civByTeam} />
      </ChartSection>
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
  title,
  query,
  isEmpty,
  skeletonHeight,
  children,
}: {
  title: string
  query: { isPending: boolean; isError: boolean; refetch: () => void }
  isEmpty: boolean
  skeletonHeight: number
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section className="bg-card shadow-card relative overflow-hidden rounded-lg p-4 pt-5">
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

interface Leader {
  alias: string
  value: number
}

/**
 * The three headline numbers. Peak rating and match volume come from the
 * tournament-scoped standings — the same source as the standings table and
 * the PEAK RATING board — so the cards agree with the rest of the page. The
 * climber is rating movement across the progression series (a player's
 * tracked rating-over-time), which has no standings equivalent.
 *
 * These used to be derived entirely from the progression series, which spans
 * a player's full tracked match history rather than the tournament window —
 * so "highest peak" surfaced a lifetime peak and "most matches" counted every
 * tracked match, neither matching the in-tournament figures the table shows.
 */
function computeStats(
  series: LabeledSeries[],
  rows: StandingsRow[]
): {
  biggestClimber: Leader | null
  highestPeak: Leader | null
  mostMatches: Leader | null
} {
  let biggestClimber: Leader | null = null
  for (const s of series) {
    if (s.points.length === 0) continue
    const delta = s.points[s.points.length - 1].rating - s.points[0].rating
    if (!biggestClimber || delta > biggestClimber.value) {
      biggestClimber = { alias: s.label, value: delta }
    }
  }

  let highestPeak: Leader | null = null
  let mostMatches: Leader | null = null
  for (const r of rows) {
    // Mirror the standings table + peak board: peak is the tournament
    // leaderboard's max_rating, volume is in-window games. Label prefers the
    // host display-name override, like those surfaces.
    const alias = r.presentation.displayName ?? r.name
    if (
      r.maxRating !== null &&
      (!highestPeak || r.maxRating > highestPeak.value)
    ) {
      highestPeak = { alias, value: r.maxRating }
    }
    if (
      r.gamesPlayed > 0 &&
      (!mostMatches || r.gamesPlayed > mostMatches.value)
    ) {
      mostMatches = { alias, value: r.gamesPlayed }
    }
  }

  return { biggestClimber, highestPeak, mostMatches }
}

/**
 * Best win rate across the standings (#225 follow-up). Win% comes from the
 * standings rows (wins / decided games), not the progression series — the
 * series only carries rating points. Players with no decided games are
 * skipped so a 0-game row can't read as 0%. The DTO also exposes a computed
 * `win_pct`, but the adapter doesn't surface it, so we derive from the
 * already-mapped wins / losses. Tiny samples (e.g. 1–0 = 100%) can lead; a
 * minimum-games threshold can be layered on later if the leaderboard warrants.
 */
function computeWinPctLeader(rows: StandingsRow[]): Leader | null {
  let leader: Leader | null = null
  for (const r of rows) {
    const decided = r.wins + r.losses
    if (decided === 0) continue
    const pct = (r.wins / decided) * 100
    if (!leader || pct > leader.value) {
      leader = { alias: r.presentation.displayName ?? r.name, value: pct }
    }
  }
  return leader
}

/**
 * Longest in-window win streak across the standings (#331). Reads the peak win
 * run the API now tracks per player (`tournament_record.longest_win_streak`,
 * surfaced by the adapter as `longestWinStreak`) — the *peak* run over the
 * whole window, distinct from `streak`, which is the *current* signed run. A
 * player on `W W W L W` has `streak = 1` but `longestWinStreak = 3`. Rows with
 * no in-window wins (`longestWinStreak === 0`) are skipped so a 0 can't read as
 * a leader. Equal streaks break on games played — the more battle-tested
 * player holds the card — then on first-seen (the standings' rank order).
 */
function computeLongestWinStreakLeader(rows: StandingsRow[]): Leader | null {
  let leader: Leader | null = null
  let leaderGames = 0
  for (const r of rows) {
    if (r.longestWinStreak <= 0) continue
    if (
      !leader ||
      r.longestWinStreak > leader.value ||
      (r.longestWinStreak === leader.value && r.gamesPlayed > leaderGames)
    ) {
      leader = {
        alias: r.presentation.displayName ?? r.name,
        value: r.longestWinStreak,
      }
      leaderGames = r.gamesPlayed
    }
  }
  return leader
}

function SummaryCards({
  series,
  standingsRows,
}: {
  series: LabeledSeries[]
  standingsRows: StandingsRow[]
}) {
  const { t } = useTranslation()
  const { biggestClimber, highestPeak, mostMatches } = useMemo(
    () => computeStats(series, standingsRows),
    [series, standingsRows]
  )
  const winPctLeader = useMemo(
    () => computeWinPctLeader(standingsRows),
    [standingsRows]
  )
  const longestWinStreak = useMemo(
    () => computeLongestWinStreakLeader(standingsRows),
    [standingsRows]
  )
  // A climber delta carries a sign (someone may be the "least dropped"); peak
  // and matches are plain counts.
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
        value={highestPeak ? String(highestPeak.value) : "—"}
        player={highestPeak?.alias ?? null}
      />
      <StatCard
        icon={Percent}
        label={t("stats.cards.winPct")}
        value={winPctLeader ? `${winPctLeader.value.toFixed(1)}%` : "—"}
        player={winPctLeader?.alias ?? null}
      />
      <StatCard
        icon={Flame}
        label={t("stats.cards.longestWinStreak")}
        value={longestWinStreak ? String(longestWinStreak.value) : "—"}
        player={longestWinStreak?.alias ?? null}
      />
      <StatCard
        icon={TrendingUp}
        label={t("stats.cards.biggestClimber")}
        value={biggestClimber ? signed(biggestClimber.value) : "—"}
        player={biggestClimber?.alias ?? null}
      />
      <StatCard
        icon={Swords}
        label={t("stats.cards.mostMatches")}
        value={mostMatches ? String(mostMatches.value) : "—"}
        player={mostMatches?.alias ?? null}
      />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  player,
}: {
  icon: LucideIcon
  label: string
  value: string
  player: string | null
}) {
  return (
    <div className="bg-card shadow-card relative flex items-center gap-3.5 overflow-hidden rounded-lg border p-4">
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
