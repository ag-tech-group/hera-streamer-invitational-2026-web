import { LineChart } from "echarts/charts"
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components"
import * as echarts from "echarts/core"
import type { EChartsCoreOption } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"
// ESM build — see rating-progression-chart.tsx for why `esm/core` not
// `lib/core` (CJS interop hands React an object).
import ReactEChartsCore from "echarts-for-react/esm/core"
import { useMemo } from "react"

import { useStableValue } from "@/hooks/use-stable-value"
import type { BumpSeries } from "@/pages/stats/bump-series"
import {
  useChartColors,
  type ChartColors,
} from "@/pages/stats/use-chart-colors"

// Trimmed echarts registration for the bump chart (line + grid/tooltip/legend).
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

/** One series' slice of the axis-trigger tooltip — its node at the hovered day. */
interface BumpTooltipParam {
  /** Axis value at the crosshair — the bucket midnight, in ms. */
  axisValue: number
  /** `[bucketMs, rank | null, rating | null]` for this series at that bucket. */
  value: [number, number | null, number | null]
  /** Resolved series (team) colour. */
  color: string
  seriesName: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Bucket date, e.g. "Jun 2, 2026" — buckets are whole days, so no time. */
function formatBucketDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Axis tooltip: a date header over that day's leaderboard — every shown player's
 * rank and rating at the hovered bucket, ordered by rank (1 first), each row
 * tinted with the player's line colour. The rank counterpart to the rating
 * chart's moment-in-time list (#280): hover anywhere and read the standings at
 * that instant. Players with no rank yet (before their first match) are dropped.
 * Returns an HTML string echarts inserts as innerHTML, so the name is escaped.
 */
function formatTooltip(params: BumpTooltipParam | BumpTooltipParam[]): string {
  const list = Array.isArray(params) ? params : [params]
  const rows = list
    .filter((p) => p.value?.[1] != null)
    .sort((a, b) => (a.value[1] as number) - (b.value[1] as number))
  if (rows.length === 0) return ""

  const header = `<div style="margin-bottom:6px;font-weight:600;color:#e2e8f0">${formatBucketDate(
    rows[0].axisValue
  )}</div>`
  const body = rows
    .map((p) => {
      const rankTag = `<span style="margin-right:6px;color:#94a3b8;font-variant-numeric:tabular-nums">#${p.value[1]}</span>`
      const dot = `<span style="display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:9999px;background:${p.color}"></span>`
      const name = `<span style="color:${p.color}">${dot}${escapeHtml(p.seriesName)}</span>`
      const left = `<span style="display:flex;align-items:center">${rankTag}${name}</span>`
      const rating = `<span style="margin-left:20px;color:#e2e8f0;font-variant-numeric:tabular-nums">${p.value[2]}</span>`
      return `<div style="display:flex;align-items:center;justify-content:space-between;line-height:1.6">${left}${rating}</div>`
    })
    .join("")
  return header + body
}

function buildOption(
  series: BumpSeries[],
  colors: ChartColors
): EChartsCoreOption {
  // Deepest rank any shown line reaches — the inverted axis runs 1 (top) to
  // this, so a slider's dive stays on-chart. minInterval keeps ticks integer.
  const maxRank = series.reduce(
    (m, s) =>
      s.points.reduce(
        (mm, p) => (p.rank != null ? Math.max(mm, p.rank) : mm),
        m
      ),
    1
  )
  return {
    backgroundColor: "transparent",
    grid: { left: 8, right: 18, top: 12, bottom: 44, containLabel: true },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: colors.label },
      inactiveColor: colors.legendInactive,
      pageTextStyle: { color: colors.axis },
      pageIconColor: colors.axis,
      pageIconInactiveColor: colors.legendInactive,
    },
    tooltip: {
      // Axis trigger, like the rating chart: hovering anywhere drops a crosshair
      // and lists the whole leaderboard at that day, ranked — not one node at a
      // time. `snap` locks the crosshair onto a real bucket.
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.95)",
      borderColor: "rgba(148,163,184,0.2)",
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      axisPointer: {
        type: "line",
        snap: true,
        lineStyle: { color: "rgba(148,163,184,0.45)", width: 1 },
      },
      formatter: formatTooltip,
    },
    xAxis: {
      type: "time",
      axisLabel: { color: colors.axis, hideOverlap: true },
      axisLine: { lineStyle: { color: colors.gridLine } },
      splitLine: { show: false },
    },
    yAxis: {
      // Rank axis, 1 at the top. `inverse` flips the value axis so the smaller
      // (better) rank sits up high; min:1 pins the leader to the top edge.
      type: "value",
      inverse: true,
      min: 1,
      max: maxRank,
      minInterval: 1,
      axisLabel: { color: colors.axis, formatter: (v: number) => `#${v}` },
      splitLine: { lineStyle: { color: colors.gridLine } },
    },
    series: series.map((s) => ({
      type: "line",
      // Stable identity so echarts merges each line in place across live
      // refetches (matching by id, not array position). The shown set is
      // append-only — once a player has reached the top N in a bucket that
      // bucket is settled — so a plain merge never strands a ghost line.
      id: s.tournamentPlayerId,
      name: s.label,
      // `[bucketMs, rank, rating]` — the chart plots [ms, rank]; the trailing
      // rating rides along untouched for the tooltip to read back.
      data: s.points.map((p) => [p.t, p.rank, p.rating]),
      // Straight segments weaving between daily rank nodes (no smoothing — a
      // curve would imply rank moved between matches it didn't).
      symbol: "circle",
      symbolSize: 7,
      showSymbol: true,
      // Skip the null gap before a player's first match rather than bridging it.
      connectNulls: false,
      itemStyle: { color: s.color },
      lineStyle: { color: s.color, width: 2.5 },
      // No hover emphasis: the axis crosshair already lists every player at the
      // hovered day, so fading all-but-one would contradict the tooltip — the
      // same call the rating chart makes (#280 follow-up).
      emphasis: { disabled: true },
    })),
  }
}

/**
 * Rank bump chart (#299) — each line is a top-contending player's leaderboard
 * rank over the tournament, weaving as ranks swap; "The Climb". Ranks are over
 * the full field (so a climb reads as a climb), shown for everyone who reached
 * the top N in any bucket — the surgers and the sliders. Team-coloured, with
 * teammates shaded apart within the team hue.
 *
 * Built on the same tree-shaken echarts core as the rating line chart and held
 * to the live-merge contract (stable series ids + `merge`, data via
 * `useStableValue`) so a refetch mid-hover updates in place instead of racing a
 * destructive rebuild.
 */
export function BumpChart({ series }: { series: BumpSeries[] }) {
  const colors = useChartColors()
  const stableSeries = useStableValue(series)
  const option = useMemo(
    () => buildOption(stableSeries, colors),
    [stableSeries, colors]
  )
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      lazyUpdate
      style={{ height: 420, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  )
}
