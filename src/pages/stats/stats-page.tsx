import { Swords, TrendingUp, Trophy } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useMemo } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { TournamentLayout } from "@/components/tournament-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useProgression } from "@/hooks/use-progression"
import { useStandings } from "@/hooks/use-standings"
import { useTeamStandings } from "@/hooks/use-team-standings"
import { teamColorSlot } from "@/lib/team-colors"
import type { TeamColorSlot } from "@/lib/team-colors"
import {
  HorizontalBarChart,
  type BarDatum,
} from "@/pages/stats/horizontal-bar-chart"
import { RatingProgressionChart } from "@/pages/stats/rating-progression-chart"
import type { PlayerSeries, StandingsRow, TeamStandingsRow } from "@/types"

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

  const teamData = teams.data ? teamBars(teams.data.rows) : []
  const peakData = standings.data ? peakBars(standings.data.rows) : []

  return (
    <TournamentLayout view="stats">
      {progression.isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <SummaryCards series={progression.data?.series ?? []} />
      )}

      <ChartSection
        title={t("stats.teamEloTitle")}
        query={teams}
        isEmpty={teamData.length === 0}
        skeletonHeight={260}
      >
        <HorizontalBarChart
          data={teamData}
          height={Math.max(180, teamData.length * 56)}
        />
      </ChartSection>

      <ChartSection
        title={t("stats.chartTitle")}
        query={progression}
        isEmpty={!progression.data || progression.data.series.length === 0}
        skeletonHeight={460}
      >
        {progression.data ? (
          <RatingProgressionChart series={progression.data.series} />
        ) : null}
      </ChartSection>

      <ChartSection
        title={t("stats.peakRatingTitle")}
        query={standings}
        isEmpty={peakData.length === 0}
        skeletonHeight={400}
      >
        <HorizontalBarChart
          data={peakData}
          height={Math.max(180, peakData.length * 28)}
        />
      </ChartSection>
    </TournamentLayout>
  )
}

/** AoE2 player-colour slots (#146) as concrete hex for the echarts canvas. */
const TEAM_HEX: Record<TeamColorSlot, string> = {
  p1: "#3b82f6",
  p2: "#ef4444",
  p3: "#22c55e",
  p4: "#eab308",
  p5: "#06b6d4",
  p6: "#ec4899",
  p7: "#94a3b8",
  p8: "#f97316",
}

/** Per-player peak-rating bars share a single brand-blue (no team join). */
const PEAK_COLOR = "#60a5fa"

/** Teams ranked by combined elo — the tournament's actual scoring metric. */
function teamBars(rows: TeamStandingsRow[]): BarDatum[] {
  return rows.map((r) => ({
    label: r.name,
    value: r.combinedRatingSum,
    color: TEAM_HEX[teamColorSlot(r.teamId)],
  }))
}

/** Players ranked by peak rating — the "only peak elos count" figure. */
function peakBars(rows: StandingsRow[]): BarDatum[] {
  return rows
    .filter(
      (r): r is StandingsRow & { maxRating: number } => r.maxRating !== null
    )
    .map((r) => ({
      // Prefer the host's display-name override (matches the standings table)
      // over the raw ladder alias.
      label: r.presentation.displayName ?? r.alias,
      value: r.maxRating,
      color: PEAK_COLOR,
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

/** The three headline numbers, derived from the rating series. */
function computeStats(series: PlayerSeries[]): {
  biggestClimber: Leader | null
  highestPeak: Leader | null
  mostMatches: Leader | null
} {
  let biggestClimber: Leader | null = null
  let highestPeak: Leader | null = null
  let mostMatches: Leader | null = null

  for (const s of series) {
    if (s.points.length === 0) continue
    const delta = s.points[s.points.length - 1].rating - s.points[0].rating
    const peak = Math.max(...s.points.map((p) => p.rating))
    const matches = s.points.length

    if (!biggestClimber || delta > biggestClimber.value) {
      biggestClimber = { alias: s.alias, value: delta }
    }
    if (!highestPeak || peak > highestPeak.value) {
      highestPeak = { alias: s.alias, value: peak }
    }
    if (!mostMatches || matches > mostMatches.value) {
      mostMatches = { alias: s.alias, value: matches }
    }
  }

  return { biggestClimber, highestPeak, mostMatches }
}

function SummaryCards({ series }: { series: PlayerSeries[] }) {
  const { t } = useTranslation()
  const { biggestClimber, highestPeak, mostMatches } = useMemo(
    () => computeStats(series),
    [series]
  )
  // A climber delta carries a sign (someone may be the "least dropped"); peak
  // and matches are plain counts.
  const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={TrendingUp}
        label={t("stats.cards.biggestClimber")}
        value={biggestClimber ? signed(biggestClimber.value) : "—"}
        player={biggestClimber?.alias ?? null}
      />
      <StatCard
        icon={Trophy}
        label={t("stats.cards.highestPeak")}
        value={highestPeak ? String(highestPeak.value) : "—"}
        player={highestPeak?.alias ?? null}
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
        className="bg-brand absolute inset-y-0 left-0 w-[3px]"
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
