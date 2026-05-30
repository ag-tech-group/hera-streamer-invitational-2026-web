import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useProgression } from "@/hooks/use-progression"
import { ViewTabs } from "@/pages/home/view-tabs"
import { RatingProgressionChart } from "@/pages/stats/rating-progression-chart"
import type { PlayerSeries, ProgressionSnapshot } from "@/types"

/**
 * Tournament-wide stats (#164), mounted at `/stats` as the third top-level
 * route alongside `/` and `/teams` (#163). Centres on a rating-progression
 * line chart fed by `GET /v1/tournaments/{slug}/progression`, with a few
 * headline stat cards derived from the same series. The route is lazy
 * (`stats.lazy.tsx`) so echarts ships in its own chunk.
 */
export function StatsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t("stats.title"))
  const progression = useProgression()

  return (
    <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-6 p-8">
      <header className="hero-divider flex flex-col gap-1 pb-4">
        <h1 className="font-display text-4xl tracking-wide">
          {t("stats.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("stats.subtitle")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <ViewTabs value="stats" />
      </div>

      <StatsContent
        snapshot={progression.data}
        isPending={progression.isPending}
        isError={progression.isError}
        onRetry={() => void progression.refetch()}
      />
    </div>
  )
}

/**
 * Picks the stats view matching the current query state, mirroring
 * `StandingsSection`'s precedence: an in-flight request shows a skeleton (not
 * empty/error), a failed request shows the error (not an empty leaderboard),
 * and only a settled, populated snapshot reaches the chart.
 */
function StatsContent({
  snapshot,
  isPending,
  isError,
  onRetry,
}: {
  snapshot: ProgressionSnapshot | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[480px] rounded-lg" />
      </div>
    )
  }

  if (isError || !snapshot) {
    return <StatsError onRetry={onRetry} />
  }

  if (snapshot.series.length === 0) {
    return <StatsEmpty />
  }

  return (
    <div className="flex flex-col gap-6">
      <SummaryCards series={snapshot.series} />
      <ChartFrame>
        <RatingProgressionChart series={snapshot.series} />
      </ChartFrame>
    </div>
  )
}

/**
 * Card frame mirroring the standings `TableShell` chrome — a brand accent
 * stripe along the top edge over the card surface — so the chart reads as
 * part of the same broadcast furniture as the tables.
 */
function ChartFrame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <section className="bg-card shadow-card relative overflow-hidden rounded-lg p-4 pt-5">
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <h2 className="text-muted-foreground font-display mb-2 px-1 text-sm tracking-widest uppercase">
        {t("stats.chartTitle")}
      </h2>
      {children}
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
        label={t("stats.cards.biggestClimber")}
        value={biggestClimber ? signed(biggestClimber.value) : "—"}
        player={biggestClimber?.alias ?? null}
      />
      <StatCard
        label={t("stats.cards.highestPeak")}
        value={highestPeak ? String(highestPeak.value) : "—"}
        player={highestPeak?.alias ?? null}
      />
      <StatCard
        label={t("stats.cards.mostMatches")}
        value={mostMatches ? String(mostMatches.value) : "—"}
        player={mostMatches?.alias ?? null}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  player,
}: {
  label: string
  value: string
  player: string | null
}) {
  return (
    <div className="bg-card shadow-card flex flex-col gap-1 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className="font-display text-3xl tracking-wide tabular-nums">
        {value}
      </p>
      {player ? (
        <p className="text-muted-foreground truncate text-sm">{player}</p>
      ) : null}
    </div>
  )
}

function StatsEmpty() {
  const { t } = useTranslation()
  return (
    <div className="bg-card shadow-card rounded-lg border p-8 text-center">
      <p className="text-muted-foreground text-sm">{t("stats.empty")}</p>
    </div>
  )
}

function StatsError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="bg-card shadow-card flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
      <p className="text-destructive text-sm">{t("stats.error")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("stats.retry")}
      </Button>
    </div>
  )
}
